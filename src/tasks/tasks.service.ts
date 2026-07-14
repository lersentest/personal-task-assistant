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
          dueAt: input.dueAt ?? null,
          dueDateType: input.dueDateType ?? null,
          remindAt: input.remindAt ?? null,
        },
      });

      await this.replaceTags(tx, task.id, input.ownerId, input.tags ?? []);
      await this.syncReminders(tx, task.id, {
        dueAt: input.dueAt ?? null,
        dueDateType: input.dueDateType ?? null,
        remindAt: input.remindAt ?? null,
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
          ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
          ...(input.dueDateType !== undefined
            ? { dueDateType: input.dueDateType }
            : {}),
          ...(input.remindAt !== undefined
            ? { remindAt: input.remindAt }
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

      if (input.status === 'COMPLETED' || input.status === 'CANCELLED') {
        await tx.reminder.updateMany({
          where: { taskId, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
      }

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
    await this.getOwned(ownerId, taskId);
    await this.prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: new Date() },
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
    const [today, overdue, upcoming, urgent] = await Promise.all([
      this.list(ownerId, { view: 'TODAY', timezone, limit: 100 }),
      this.list(ownerId, { view: 'OVERDUE', timezone, limit: 100 }),
      this.list(ownerId, { view: 'UPCOMING', timezone, limit: 100 }),
      this.prisma.task.count({
        where: {
          ownerId,
          deletedAt: null,
          status: { in: [...ACTIVE_STATUSES] },
          priority: 'URGENT',
        },
      }),
    ]);
    return {
      today: today.length,
      overdue: overdue.length,
      upcoming: upcoming.length,
      urgent,
    };
  }

  calendar(ownerId: string, timezone: string) {
    return this.list(ownerId, {
      view: 'ALL',
      timezone,
      limit: 100,
      sort: 'dueAt',
    }).then((tasks) => tasks.filter((task) => task.dueAt));
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
