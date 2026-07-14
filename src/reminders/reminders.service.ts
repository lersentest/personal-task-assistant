import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { PrismaService } from '../database/prisma.service';
import { TasksService } from '../tasks/tasks.service';

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
  ) {}

  due(now = new Date()) {
    return this.prisma.reminder.findMany({
      where: {
        status: 'PENDING',
        remindAt: { lte: now },
        task: {
          deletedAt: null,
          status: { in: ['NEW', 'IN_PROGRESS'] },
        },
      },
      include: {
        task: {
          include: {
            owner: true,
            project: true,
          },
        },
      },
      orderBy: { remindAt: 'asc' },
      take: 50,
    });
  }

  markSent(reminderId: string) {
    return this.prisma.reminder.update({
      where: { id: reminderId },
      data: { status: 'SENT', sentAt: new Date() },
    });
  }

  async scheduleNextOverdue(reminder: {
    type: string;
    task: {
      id: string;
      dueAt: Date | null;
      owner: { timezone: string };
    };
  }): Promise<void> {
    if (!['DUE_DATE', 'OVERDUE'].includes(reminder.type)) return;
    if (!reminder.task.dueAt || reminder.task.dueAt.getTime() > Date.now()) return;

    const next = DateTime.now()
      .setZone(reminder.task.owner.timezone)
      .plus({ days: 1 })
      .startOf('day')
      .plus({ hours: 7 })
      .toUTC()
      .toJSDate();
    const existing = await this.prisma.reminder.findFirst({
      where: {
        taskId: reminder.task.id,
        status: 'PENDING',
        type: 'OVERDUE',
        remindAt: { gte: new Date(Date.now() - 60_000) },
      },
    });
    if (!existing) {
      await this.prisma.reminder.create({
        data: {
          taskId: reminder.task.id,
          remindAt: next,
          type: 'OVERDUE',
        },
      });
    }
  }

  async snooze(ownerId: string, taskId: string, minutes = 60) {
    const task = await this.tasks.getOwned(ownerId, taskId);
    const remindAt = new Date(Date.now() + minutes * 60_000);
    await this.prisma.reminder.create({
      data: {
        taskId: task.id,
        remindAt,
        type: 'SNOOZE',
      },
    });
    await this.prisma.task.update({
      where: { id: task.id },
      data: { remindAt },
    });
    return remindAt;
  }

  cancelPending(taskId: string) {
    return this.prisma.reminder.updateMany({
      where: { taskId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
  }
}
