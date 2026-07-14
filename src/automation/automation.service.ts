import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { Api, InlineKeyboard } from 'grammy';
import { DateTime } from 'luxon';
import { PrismaService } from '../database/prisma.service';
import { RemindersService } from '../reminders/reminders.service';
import { TasksService } from '../tasks/tasks.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);
  private readonly api: Api;
  private remindersRunning = false;
  private summariesRunning = false;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly reminders: RemindersService,
    private readonly tasks: TasksService,
    private readonly users: UsersService,
  ) {
    this.api = new Api(config.getOrThrow<string>('TELEGRAM_BOT_TOKEN'));
  }

  @Interval(60_000)
  async deliverReminders(): Promise<void> {
    if (this.remindersRunning) return;
    this.remindersRunning = true;
    try {
      for (const reminder of await this.reminders.due()) {
        try {
          const project = reminder.task.project?.name ?? 'Без проекта';
          const keyboard = new InlineKeyboard()
            .text('✅ Выполнено', `task:status:${reminder.task.id}:COMPLETED`)
            .text('⏰ Через час', `task:snooze:${reminder.task.id}`)
            .row()
            .text('📋 Открыть задачу', `task:open:${reminder.task.id}`);
          await this.api.sendMessage(
            reminder.task.owner.telegramId.toString(),
            [
              '⏰ Напоминание',
              '',
              reminder.task.title,
              `Проект: ${project}`,
            ].join('\n'),
            { reply_markup: keyboard },
          );
          await this.reminders.markSent(reminder.id);
          await this.reminders.scheduleNextOverdue(reminder);
        } catch (error: unknown) {
          this.logger.error(
            `Reminder ${reminder.id}: ${this.errorMessage(error)}`,
          );
        }
      }
    } finally {
      this.remindersRunning = false;
    }
  }

  @Interval(60_000)
  async deliverDailySummaries(): Promise<void> {
    if (this.summariesRunning) return;
    this.summariesRunning = true;
    try {
      for (const user of await this.users.listAll()) {
        const local = DateTime.now().setZone(user.timezone);
        if (local.hour !== 7 || local.minute > 4) continue;
        const localDate = local.toISODate();
        if (!localDate) continue;

        const delivered = await this.prisma.dailySummaryDelivery.findUnique({
          where: { userId_localDate: { userId: user.id, localDate } },
        });
        if (delivered) continue;

        try {
          const summary = await this.tasks.summary(user.id, user.timezone);
          const keyboard = new InlineKeyboard()
            .text('Сегодня', 'view:TODAY')
            .text('Просроченные', 'view:OVERDUE');
          const text = summary.today
            ? [
                '☀️ Доброе утро',
                '',
                `Сегодня: ${summary.today}`,
                `Просрочено: ${summary.overdue}`,
                `На ближайшие 7 дней: ${summary.upcoming}`,
                `Срочных: ${summary.urgent}`,
              ].join('\n')
            : [
                '☀️ Доброе утро',
                '',
                'На сегодня активных задач нет.',
                `Просрочено: ${summary.overdue}`,
                `На ближайшие 7 дней: ${summary.upcoming}`,
              ].join('\n');
          await this.api.sendMessage(user.telegramId.toString(), text, {
            reply_markup: keyboard,
          });
          await this.prisma.dailySummaryDelivery.create({
            data: { userId: user.id, localDate },
          });
        } catch (error: unknown) {
          this.logger.error(
            `Daily summary for ${user.id}: ${this.errorMessage(error)}`,
          );
        }
      }
    } finally {
      this.summariesRunning = false;
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown automation error';
  }
}
