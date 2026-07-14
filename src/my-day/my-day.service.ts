import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TasksService } from '../tasks/tasks.service';

const taskInclude = {
  project: true,
  tags: { include: { tag: true } },
} as const;

const itemInclude = {
  task: { include: taskInclude },
} as const;

type DailyPlanItemWithTask = Prisma.DailyPlanItemGetPayload<{
  include: typeof itemInclude;
}>;

const ACTIVE_STATUSES = ['NEW', 'IN_PROGRESS'] as const;
@Injectable()
export class MyDayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
  ) {}

  async getDay(userId: string, timezone: string, date: string) {
    const range = this.dayRange(date, timezone);
    const dateOnly = this.dateOnly(date);

    const [items, overdue, dueToday] = await Promise.all([
      this.prisma.dailyPlanItem.findMany({
        where: { userId, date: dateOnly, removedAt: null },
        include: itemInclude,
        orderBy: [{ order: 'asc' }, { addedAt: 'asc' }],
      }),
      this.prisma.task.findMany({
        where: {
          ownerId: userId,
          deletedAt: null,
          status: { in: [...ACTIVE_STATUSES] },
          dueAt: { lt: range.start },
        },
        include: taskInclude,
        orderBy: [{ dueAt: 'asc' }, { priority: 'desc' }],
        take: 100,
      }),
      this.prisma.task.findMany({
        where: {
          ownerId: userId,
          deletedAt: null,
          status: { in: [...ACTIVE_STATUSES] },
          dueAt: { gte: range.start, lt: range.end },
        },
        include: taskInclude,
        orderBy: [{ dueAt: 'asc' }, { priority: 'desc' }],
        take: 100,
      }),
    ]);

    const activeItems = items.filter((item) => item.task.deletedAt === null);
    const plannedTaskIds = new Set(activeItems.map((item) => item.taskId));
    const unscheduledItems = activeItems.filter((item) => !item.scheduledStartAt);
    const scheduledItems = activeItems
      .filter((item) => item.scheduledStartAt)
      .sort((a, b) => (a.scheduledStartAt?.getTime() ?? 0) - (b.scheduledStartAt?.getTime() ?? 0));
    const completedItems = activeItems.filter(
      (item) => item.completedInPlanAt || item.task.status === 'COMPLETED',
    );

    const mandatory = {
      overdue: overdue.filter((task) => !plannedTaskIds.has(task.id)),
      dueToday: dueToday.filter((task) => !plannedTaskIds.has(task.id)),
      plannedToday: unscheduledItems,
      scheduled: scheduledItems,
    };

    const planTasks = [
      ...activeItems.map((item) => item.task),
      ...mandatory.overdue,
      ...mandatory.dueToday,
    ];
    const uniquePlanTasks = [...new Map(planTasks.map((task) => [task.id, task])).values()];
    const estimatedMinutes = uniquePlanTasks.reduce(
      (sum, task) => sum + (task.estimatedDurationMinutes ?? 0),
      0,
    );
    const completedMinutes = uniquePlanTasks.reduce(
      (sum, task) =>
        task.status === 'COMPLETED'
          ? sum + (task.estimatedDurationMinutes ?? 0)
          : sum,
      0,
    );

    return {
      date,
      settings: {
        dayStart: '07:00',
        dayEnd: '20:00',
        capacityMinutes: 8 * 60,
        calendarStepMinutes: 15,
        timezone,
      },
      summary: {
        totalTasks: uniquePlanTasks.length,
        completedTasks: uniquePlanTasks.filter((task) => task.status === 'COMPLETED').length,
        remainingTasks: uniquePlanTasks.filter((task) => task.status !== 'COMPLETED').length,
        estimatedMinutes,
        completedMinutes,
        overloaded: estimatedMinutes > 8 * 60,
        conflicts: this.findConflicts(scheduledItems).length,
      },
      mandatory,
      planItems: activeItems,
      scheduledItems,
      completedItems,
      conflicts: this.findConflicts(scheduledItems),
      unresolvedPreviousDays: await this.findUnresolvedPreviousDays(userId, dateOnly),
    };
  }

  async suggestions(
    userId: string,
    date: string,
    options: {
      search?: string;
      projectId?: string;
      priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
      tagId?: string;
      unassigned?: boolean;
      limit?: number;
    },
  ) {
    const dateOnly = this.dateOnly(date);
    const planned = await this.prisma.dailyPlanItem.findMany({
      where: { userId, date: dateOnly, removedAt: null },
      select: { taskId: true },
    });
    const excludedIds = planned.map((item) => item.taskId);

    return this.prisma.task.findMany({
      where: {
        ownerId: userId,
        deletedAt: null,
        status: { in: [...ACTIVE_STATUSES] },
        id: excludedIds.length ? { notIn: excludedIds } : undefined,
        projectId: options.unassigned ? null : options.projectId,
        priority: options.priority,
        tags: options.tagId ? { some: { tagId: options.tagId } } : undefined,
        OR: options.search
          ? [
              { title: { contains: options.search, mode: 'insensitive' } },
              { description: { contains: options.search, mode: 'insensitive' } },
              { project: { name: { contains: options.search, mode: 'insensitive' } } },
            ]
          : undefined,
      },
      include: taskInclude,
      orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }],
      take: Math.min(options.limit ?? 40, 100),
    });
  }

  async addItem(
    userId: string,
    input: {
      taskId: string;
      date: string;
      scheduledStartAt?: Date | null;
      scheduledEndAt?: Date | null;
      estimatedDurationMinutes?: number | null;
    },
  ) {
    await this.tasks.getOwned(userId, input.taskId);
    const dateOnly = this.dateOnly(input.date);

    return this.prisma.$transaction(async (tx) => {
      if (input.estimatedDurationMinutes !== undefined) {
        await tx.task.update({
          where: { id: input.taskId },
          data: { estimatedDurationMinutes: input.estimatedDurationMinutes },
        });
      }

      const existing = await tx.dailyPlanItem.findFirst({
        where: { userId, taskId: input.taskId, date: dateOnly, removedAt: null },
        include: itemInclude,
      });
      if (existing) return existing;

      const last = await tx.dailyPlanItem.findFirst({
        where: { userId, date: dateOnly, removedAt: null },
        orderBy: { order: 'desc' },
        select: { order: true },
      });

      return tx.dailyPlanItem.create({
        data: {
          userId,
          taskId: input.taskId,
          date: dateOnly,
          order: (last?.order ?? -1) + 1,
          scheduledStartAt: input.scheduledStartAt ?? null,
          scheduledEndAt: input.scheduledEndAt ?? null,
          scheduleType: input.scheduledStartAt ? 'FIXED' : 'FLEXIBLE',
        },
        include: itemInclude,
      });
    });
  }

  async updateItem(
    userId: string,
    itemId: string,
    input: {
      date?: string;
      order?: number;
      scheduledStartAt?: Date | null;
      scheduledEndAt?: Date | null;
      estimatedDurationMinutes?: number | null;
    },
  ) {
    const item = await this.getOwnedItem(userId, itemId);
    return this.prisma.$transaction(async (tx) => {
      if (input.estimatedDurationMinutes !== undefined) {
        await tx.task.update({
          where: { id: item.taskId },
          data: { estimatedDurationMinutes: input.estimatedDurationMinutes },
        });
      }

      return tx.dailyPlanItem.update({
        where: { id: itemId },
        data: {
          ...(input.date ? { date: this.dateOnly(input.date) } : {}),
          ...(input.order !== undefined ? { order: input.order } : {}),
          ...(input.scheduledStartAt !== undefined
            ? { scheduledStartAt: input.scheduledStartAt }
            : {}),
          ...(input.scheduledEndAt !== undefined
            ? { scheduledEndAt: input.scheduledEndAt }
            : {}),
          ...(input.scheduledStartAt !== undefined || input.scheduledEndAt !== undefined
            ? { scheduleType: input.scheduledStartAt ? 'FIXED' : 'FLEXIBLE' }
            : {}),
        },
        include: itemInclude,
      });
    });
  }

  async removeItem(userId: string, itemId: string) {
    await this.getOwnedItem(userId, itemId);
    await this.prisma.dailyPlanItem.update({
      where: { id: itemId },
      data: { removedAt: new Date(), scheduledStartAt: null, scheduledEndAt: null },
    });
    return { ok: true };
  }

  async scheduleItem(
    userId: string,
    itemId: string,
    input: {
      scheduledStartAt: Date;
      scheduledEndAt: Date;
      estimatedDurationMinutes?: number | null;
    },
  ) {
    if (input.scheduledEndAt <= input.scheduledStartAt) {
      throw new BadRequestException('Конец должен быть позже начала.');
    }
    return this.updateItem(userId, itemId, {
      scheduledStartAt: input.scheduledStartAt,
      scheduledEndAt: input.scheduledEndAt,
      estimatedDurationMinutes: input.estimatedDurationMinutes,
    });
  }

  async unscheduleItem(userId: string, itemId: string) {
    return this.updateItem(userId, itemId, {
      scheduledStartAt: null,
      scheduledEndAt: null,
    });
  }

  async reorder(userId: string, date: string, itemIds: string[]) {
    const dateOnly = this.dateOnly(date);
    const owned = await this.prisma.dailyPlanItem.findMany({
      where: { userId, date: dateOnly, removedAt: null, id: { in: itemIds } },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((item) => item.id));
    if (ownedIds.size !== itemIds.length) {
      throw new BadRequestException('В списке есть задачи не из этого дня.');
    }

    await this.prisma.$transaction(
      itemIds.map((id, index) =>
        this.prisma.dailyPlanItem.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );
    return { ok: true };
  }

  async completeItem(userId: string, itemId: string) {
    const item = await this.getOwnedItem(userId, itemId);
    await this.tasks.update(userId, item.taskId, { status: 'COMPLETED' });
    return this.prisma.dailyPlanItem.update({
      where: { id: itemId },
      data: { completedInPlanAt: new Date() },
      include: itemInclude,
    });
  }

  async completeDay(
    userId: string,
    timezone: string,
    input: {
      date: string;
      actions: Array<{
        itemId: string;
        action: 'TOMORROW' | 'BACKLOG' | 'KEEP' | 'CANCEL';
        date?: string;
      }>;
    },
  ) {
    for (const action of input.actions) {
      const item = await this.getOwnedItem(userId, action.itemId);
      if (item.task.status === 'COMPLETED') continue;

      if (action.action === 'TOMORROW') {
        const targetDate =
          action.date ??
          DateTime.fromISO(input.date, { zone: timezone }).plus({ days: 1 }).toISODate();
        if (targetDate) {
          await this.addItem(userId, { taskId: item.taskId, date: targetDate });
          await this.removeItem(userId, item.id);
        }
      } else if (action.action === 'BACKLOG') {
        await this.removeItem(userId, item.id);
      } else if (action.action === 'CANCEL') {
        await this.tasks.update(userId, item.taskId, { status: 'CANCELLED' });
        await this.removeItem(userId, item.id);
      }
    }

    return this.getDay(userId, timezone, input.date);
  }

  history(userId: string, limit = 30) {
    return this.prisma.dailyPlanItem.groupBy({
      by: ['date'],
      where: { userId },
      _count: { id: true },
      orderBy: { date: 'desc' },
      take: limit,
    });
  }

  private async getOwnedItem(userId: string, itemId: string): Promise<DailyPlanItemWithTask> {
    const item = await this.prisma.dailyPlanItem.findFirst({
      where: { id: itemId, userId, removedAt: null },
      include: itemInclude,
    });
    if (!item) throw new NotFoundException('Задача дня не найдена.');
    return item;
  }

  private dateOnly(date: string) {
    const parsed = DateTime.fromISO(date, { zone: 'utc' });
    if (!parsed.isValid) throw new BadRequestException('Некорректная дата.');
    return new Date(`${parsed.toISODate()}T00:00:00.000Z`);
  }

  private dayRange(date: string, timezone: string) {
    const start = DateTime.fromISO(date, { zone: timezone }).startOf('day');
    if (!start.isValid) throw new BadRequestException('Некорректная дата.');
    return {
      start: start.toUTC().toJSDate(),
      end: start.plus({ days: 1 }).toUTC().toJSDate(),
    };
  }

  private findConflicts(items: DailyPlanItemWithTask[]) {
    const scheduled = items
      .filter((item) => item.scheduledStartAt && item.scheduledEndAt)
      .sort((a, b) => (a.scheduledStartAt?.getTime() ?? 0) - (b.scheduledStartAt?.getTime() ?? 0));
    const conflicts: Array<{ firstItemId: string; secondItemId: string }> = [];
    for (let index = 1; index < scheduled.length; index += 1) {
      const previous = scheduled[index - 1];
      const current = scheduled[index];
      if (
        previous.scheduledEndAt &&
        current.scheduledStartAt &&
        previous.scheduledEndAt > current.scheduledStartAt
      ) {
        conflicts.push({ firstItemId: previous.id, secondItemId: current.id });
      }
    }
    return conflicts;
  }

  private async findUnresolvedPreviousDays(userId: string, currentDate: Date) {
    return this.prisma.dailyPlanItem.findMany({
      where: {
        userId,
        date: { lt: currentDate },
        removedAt: null,
        completedInPlanAt: null,
        task: {
          deletedAt: null,
          status: { in: [...ACTIVE_STATUSES] },
        },
      },
      include: itemInclude,
      orderBy: [{ date: 'desc' }, { order: 'asc' }],
      take: 30,
    });
  }
}
