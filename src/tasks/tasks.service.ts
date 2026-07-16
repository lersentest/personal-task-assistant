import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateTaskInput } from './types/create-task.input';
import { BulkTaskFilter, ListTasksOptions } from './types/task-view';
import { UpdateTaskInput } from './types/update-task.input';

const taskInclude = {
  project: true,
  tags: { include: { tag: true } },
  reminders: {
    where: { status: 'PENDING' as const },
    orderBy: { remindAt: 'asc' as const },
  },
} as const;

export type TaskDetails = Prisma.TaskGetPayload<{
  include: typeof taskInclude;
}>;

const ACTIVE_STATUSES = ['NEW', 'IN_PROGRESS'] as const;
const PRIORITY_WEIGHT: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateTaskInput): Promise<TaskDetails> {
    const title = input.title.trim();
    if (!title) {
      throw new BadRequestException('Название задачи не может быть пустым.');
    }

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          ownerId: input.ownerId,
          createdById: input.createdById,
          assigneeId: input.assigneeId,
          projectId: input.projectId ?? null,
          title,
          description: input.description?.trim() || null,
          originalText: input.originalText?.trim() || null,
          sourceType: input.sourceType ?? 'TEXT',
          status: input.status ?? 'NEW',
          priority: input.priority ?? 'NORMAL',
          kind: input.kind ?? 'TASK',
          isFlexible: input.isFlexible ?? input.dueDateType !== 'EXACT_TIME',
          dueAt: input.dueAt ?? null,
          dueDateType: input.dueDateType ?? null,
          remindAt: input.remindAt ?? null,
          estimatedDurationMinutes: input.estimatedDurationMinutes ?? null,
        },
      });

      await this.replaceTags(tx, task.id, input.ownerId, input.tags ?? []);
      await this.syncReminders(tx, task.id, {
        dueAt: input.dueAt ?? null,
        dueDateType: input.dueDateType ?? null,
        remindAt: input.remindAt ?? null,
      });
      await this.syncExactTimeDailyPlan(tx, {
        ownerId: input.ownerId,
        taskId: task.id,
        dueAt: input.dueAt ?? null,
        dueDateType: input.dueDateType ?? null,
        estimatedDurationMinutes: input.estimatedDurationMinutes ?? null,
      });

      await tx.activityEvent.create({
        data: {
          ownerId: input.ownerId,
          actorId: input.createdById,
          type: 'TASK_CREATED',
          taskId: task.id,
          projectId: input.projectId ?? null,
          title,
          metadata: {
            priority: input.priority ?? 'NORMAL',
            kind: input.kind ?? 'TASK',
          },
        },
      });

      return tx.task.findUniqueOrThrow({
        where: { id: task.id },
        include: taskInclude,
      });
    });
  }

  async update(
    ownerId: string,
    taskId: string,
    input: UpdateTaskInput,
  ): Promise<TaskDetails> {
    await this.getOwned(ownerId, taskId, true);
    if (input.title !== undefined && !input.title.trim()) {
      throw new BadRequestException('Название задачи не может быть пустым.');
    }

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const statusTimes = input.status
        ? {
            completedAt: input.status === 'COMPLETED' ? now : null,
            cancelledAt: input.status === 'CANCELLED' ? now : null,
          }
        : {};

      await tx.task.update({
        where: { id: taskId },
        data: {
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.description !== undefined
            ? { description: input.description?.trim() || null }
            : {}),
          ...(input.projectId !== undefined
            ? { projectId: input.projectId }
            : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.priority !== undefined
            ? { priority: input.priority }
            : {}),
          ...(input.kind !== undefined ? { kind: input.kind } : {}),
          ...(input.isFlexible !== undefined
            ? { isFlexible: input.isFlexible }
            : {}),
          ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
          ...(input.dueDateType !== undefined
            ? { dueDateType: input.dueDateType }
            : {}),
          ...(input.remindAt !== undefined
            ? { remindAt: input.remindAt }
            : {}),
          ...(input.estimatedDurationMinutes !== undefined
            ? { estimatedDurationMinutes: input.estimatedDurationMinutes }
            : {}),
          ...statusTimes,
        },
      });

      if (input.tags !== undefined) {
        await this.replaceTags(tx, taskId, ownerId, input.tags);
      }

      if (
        input.remindAt !== undefined ||
        input.dueAt !== undefined ||
        input.dueDateType !== undefined
      ) {
        await tx.reminder.updateMany({
          where: { taskId, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
        const taskForReminders = await tx.task.findUniqueOrThrow({
          where: { id: taskId },
          select: { dueAt: true, dueDateType: true, remindAt: true },
        });
        await this.syncReminders(tx, taskId, taskForReminders);
      }

      if (
        input.dueAt !== undefined ||
        input.dueDateType !== undefined ||
        input.estimatedDurationMinutes !== undefined
      ) {
        const taskForPlan = await tx.task.findUniqueOrThrow({
          where: { id: taskId },
          select: {
            dueAt: true,
            dueDateType: true,
            estimatedDurationMinutes: true,
          },
        });
        await this.syncExactTimeDailyPlan(tx, {
          ownerId,
          taskId,
          dueAt: taskForPlan.dueAt,
          dueDateType: taskForPlan.dueDateType,
          estimatedDurationMinutes: taskForPlan.estimatedDurationMinutes,
        });
      }

      if (input.status === 'COMPLETED' || input.status === 'CANCELLED') {
        await tx.reminder.updateMany({
          where: { taskId, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
      }

      const updatedTask = await tx.task.findUniqueOrThrow({
        where: { id: taskId },
        select: { title: true, projectId: true, status: true },
      });

      await tx.activityEvent.create({
        data: {
          ownerId,
          actorId: ownerId,
          type:
            input.status === 'COMPLETED'
              ? 'TASK_COMPLETED'
              : 'TASK_UPDATED',
          taskId,
          projectId: updatedTask.projectId,
          title: updatedTask.title,
          metadata: { status: updatedTask.status },
        },
      });

      return tx.task.findUniqueOrThrow({
        where: { id: taskId },
        include: taskInclude,
      });
    });
  }

  async list(ownerId: string, options: ListTasksOptions): Promise<TaskDetails[]> {
    const now = DateTime.now().setZone(options.timezone);
    const startToday = now.startOf('day').toUTC().toJSDate();
    const startTomorrow = now.plus({ days: 1 }).startOf('day').toUTC().toJSDate();
    const endUpcoming = now.plus({ days: 8 }).startOf('day').toUTC().toJSDate();

    const where: Prisma.TaskWhereInput = {
      ownerId,
      ...(options.view === 'TRASH'
        ? { deletedAt: { not: null } }
        : { deletedAt: null }),
      ...(options.projectId ? { projectId: options.projectId } : {}),
      ...(options.unassigned ? { projectId: null } : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(options.priority ? { priority: options.priority } : {}),
      ...(options.kind ? { kind: options.kind } : {}),
      ...(options.tagId
        ? { tags: { some: { tagId: options.tagId } } }
        : {}),
      ...(options.search
        ? {
            OR: [
              { title: { contains: options.search, mode: 'insensitive' } },
              {
                description: {
                  contains: options.search,
                  mode: 'insensitive',
                },
              },
              {
                project: {
                  name: { contains: options.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    if (options.view === 'TODAY') {
      where.status = { in: [...ACTIVE_STATUSES] };
      where.dueAt = { gte: startToday, lt: startTomorrow };
    } else if (options.view === 'OVERDUE') {
      where.status = { in: [...ACTIVE_STATUSES] };
      where.dueAt = { lt: new Date() };
    } else if (options.view === 'UPCOMING') {
      where.status = { in: [...ACTIVE_STATUSES] };
      where.dueAt = { gte: startTomorrow, lt: endUpcoming };
    } else if (options.view === 'COMPLETED') {
      where.status = 'COMPLETED';
    } else if (options.view === 'CANCELLED') {
      where.status = 'CANCELLED';
    }

    const tasks = await this.prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy:
        options.sort === 'createdAt'
          ? [{ createdAt: 'desc' }]
          : options.sort === 'updatedAt'
            ? [{ updatedAt: 'desc' }]
            : [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      take: Math.min(options.limit ?? 40, 100),
    });

    return tasks.sort((a, b) => {
      const priorityDifference =
        PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
      if (priorityDifference !== 0) return priorityDifference;
      const aDue = a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDue = b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    });
  }

  getOwned(
    ownerId: string,
    taskId: string,
    includeDeleted = false,
  ): Promise<TaskDetails> {
    return this.prisma.task
      .findFirst({
        where: {
          id: taskId,
          ownerId,
          ...(includeDeleted ? {} : { deletedAt: null }),
        },
        include: taskInclude,
      })
      .then((task) => {
        if (!task) throw new NotFoundException('Задача не найдена.');
        return task;
      });
  }

  async findCandidates(ownerId: string, query: string): Promise<TaskDetails[]> {
    const search = query.trim();
    if (!search) return [];
    return this.prisma.task.findMany({
      where: {
        ownerId,
        deletedAt: null,
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          {
            project: { name: { contains: search, mode: 'insensitive' } },
          },
        ],
      },
      include: taskInclude,
      orderBy: { updatedAt: 'desc' },
      take: 8,
    });
  }

  async findBulkCandidates(
    ownerId: string,
    timezone: string,
    filter: BulkTaskFilter,
  ): Promise<TaskDetails[]> {
    const projectId = filter.projectId ?? undefined;
    const tagId = undefined;
    return this.list(ownerId, {
      view: filter.view ?? 'ALL',
      timezone,
      limit: 100,
      ...(projectId ? { projectId } : {}),
      ...(filter.search ? { search: filter.search } : {}),
      ...(tagId ? { tagId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.priority ? { priority: filter.priority } : {}),
      ...(filter.kind ? { kind: filter.kind } : {}),
      ...(filter.unassigned ? { unassigned: true } : {}),
      sort: 'updatedAt',
    }).then((tasks) =>
      filter.tag
        ? tasks.filter((task) =>
            task.tags.some(
              ({ tag }) =>
                tag.name.toLocaleLowerCase('ru-RU') ===
                filter.tag?.toLocaleLowerCase('ru-RU'),
            ),
          )
        : tasks,
    );
  }

  async bulkUpdate(
    ownerId: string,
    taskIds: string[],
    changes: UpdateTaskInput,
  ): Promise<TaskDetails[]> {
    const uniqueTaskIds = [...new Set(taskIds)];
    if (uniqueTaskIds.length === 0) return [];
    const updated: TaskDetails[] = [];
    for (const taskId of uniqueTaskIds) {
      updated.push(await this.update(ownerId, taskId, changes));
    }
    return updated;
  }

  async softDelete(ownerId: string, taskId: string): Promise<void> {
    const task = await this.getOwned(ownerId, taskId);
    await this.prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: taskId },
        data: { deletedAt: new Date() },
      });
      await tx.activityEvent.create({
        data: {
          ownerId,
          actorId: ownerId,
          type: 'TASK_DELETED',
          taskId,
          projectId: task.projectId,
          title: task.title,
        },
      });
    });
  }

  async restore(ownerId: string, taskId: string): Promise<TaskDetails> {
    await this.getOwned(ownerId, taskId, true);
    await this.prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: null },
    });
    return this.getOwned(ownerId, taskId);
  }

  async summary(ownerId: string, timezone: string) {
    const now = DateTime.now().setZone(timezone);
    const startToday = now.startOf('day').toUTC().toJSDate();
    const startTomorrow = now.plus({ days: 1 }).startOf('day').toUTC().toJSDate();
    const endUpcoming = now.plus({ days: 8 }).startOf('day').toUTC().toJSDate();
    const activeWhere = {
      ownerId,
      deletedAt: null,
      status: { in: [...ACTIVE_STATUSES] },
    } satisfies Prisma.TaskWhereInput;

    const [today, overdue, upcoming, urgent] = await Promise.all([
      this.prisma.task.count({
        where: {
          ...activeWhere,
          dueAt: { gte: startToday, lt: startTomorrow },
        },
      }),
      this.prisma.task.count({
        where: {
          ...activeWhere,
          dueAt: { lt: new Date() },
        },
      }),
      this.prisma.task.count({
        where: {
          ...activeWhere,
          dueAt: { gte: startTomorrow, lt: endUpcoming },
        },
      }),
      this.prisma.task.count({
        where: {
          ...activeWhere,
          priority: 'URGENT',
        },
      }),
    ]);
    return {
      today,
      overdue,
      upcoming,
      urgent,
    };
  }

  calendar(ownerId: string, _timezone: string) {
    return this.prisma.task.findMany({
      where: {
        ownerId,
        deletedAt: null,
        dueAt: { not: null },
      },
      include: taskInclude,
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  private async replaceTags(
    tx: Prisma.TransactionClient,
    taskId: string,
    ownerId: string,
    rawTags: string[],
  ): Promise<void> {
    const tags = this.normalizeTags(rawTags);
    await tx.taskTag.deleteMany({ where: { taskId } });
    for (const name of tags) {
      const normalizedName = name.toLocaleLowerCase('ru-RU');
      const tag = await tx.tag.upsert({
        where: { ownerId_normalizedName: { ownerId, normalizedName } },
        update: { name },
        create: { ownerId, name, normalizedName },
      });
      await tx.taskTag.create({ data: { taskId, tagId: tag.id } });
    }
  }

  private normalizeTags(tags: string[]): string[] {
    return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))]
      .slice(0, 10)
      .map((tag) => tag.slice(0, 80));
  }

  private async syncExactTimeDailyPlan(
    tx: Prisma.TransactionClient,
    input: {
      ownerId: string;
      taskId: string;
      dueAt: Date | null;
      dueDateType: 'ON_DATE' | 'BEFORE_DATE' | 'EXACT_TIME' | null;
      estimatedDurationMinutes: number | null;
    },
  ): Promise<void> {
    if (input.dueDateType !== 'EXACT_TIME' || !input.dueAt) return;

    const owner = await tx.user.findUnique({
      where: { id: input.ownerId },
      select: { timezone: true },
    });
    const timezone = owner?.timezone ?? 'Europe/Zurich';
    const localDate = DateTime.fromJSDate(input.dueAt)
      .setZone(timezone)
      .toISODate();
    if (!localDate) return;

    const date = new Date(`${localDate}T00:00:00.000Z`);
    const duration = input.estimatedDurationMinutes ?? 30;
    const scheduledEndAt = new Date(input.dueAt.getTime() + duration * 60_000);
    const existing = await tx.dailyPlanItem.findFirst({
      where: { userId: input.ownerId, taskId: input.taskId, removedAt: null },
      select: { id: true },
    });

    if (existing) {
      await tx.dailyPlanItem.update({
        where: { id: existing.id },
        data: {
          date,
          scheduledStartAt: input.dueAt,
          scheduledEndAt,
          scheduleType: 'FIXED',
        },
      });
      return;
    }

    const last = await tx.dailyPlanItem.findFirst({
      where: { userId: input.ownerId, date, removedAt: null },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    await tx.dailyPlanItem.create({
      data: {
        userId: input.ownerId,
        taskId: input.taskId,
        date,
        order: (last?.order ?? -1) + 1,
        scheduledStartAt: input.dueAt,
        scheduledEndAt,
        scheduleType: 'FIXED',
      },
    });
  }

  private async syncReminders(
    tx: Prisma.TransactionClient,
    taskId: string,
    dates: {
      dueAt: Date | null;
      dueDateType: 'ON_DATE' | 'BEFORE_DATE' | 'EXACT_TIME' | null;
      remindAt: Date | null;
    },
  ): Promise<void> {
    const reminders: Array<{
      remindAt: Date;
      type: 'CUSTOM' | 'DAY_BEFORE' | 'DUE_DATE';
    }> = [];

    if (dates.remindAt) {
      reminders.push({
        remindAt: dates.remindAt,
        type:
          dates.dueDateType === 'BEFORE_DATE'
            ? 'DAY_BEFORE'
            : dates.dueDateType === 'ON_DATE'
              ? 'DUE_DATE'
              : 'CUSTOM',
      });
    } else if (dates.dueAt) {
      reminders.push({
        remindAt:
          dates.dueDateType === 'BEFORE_DATE'
            ? new Date(dates.dueAt.getTime() - 22 * 60 * 60_000)
            : dates.dueDateType === 'EXACT_TIME'
            ? new Date(dates.dueAt.getTime() - 60 * 60_000)
            : dates.dueAt,
        type:
          dates.dueDateType === 'BEFORE_DATE' ? 'DAY_BEFORE' : 'DUE_DATE',
      });
    }

    if (
      dates.dueAt &&
      dates.dueDateType === 'BEFORE_DATE' &&
      !reminders.some(
        (reminder) => reminder.remindAt.getTime() === dates.dueAt?.getTime(),
      )
    ) {
      reminders.push({ remindAt: dates.dueAt, type: 'DUE_DATE' });
    }

    for (const reminder of reminders) {
      if (reminder.remindAt.getTime() <= Date.now() - 60_000) continue;
      await tx.reminder.create({
        data: { taskId, ...reminder },
      });
    }
  }
}
