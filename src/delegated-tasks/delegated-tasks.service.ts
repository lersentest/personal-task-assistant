import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Api, InlineKeyboard } from 'grammy';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ExecutorsService } from '../executors/executors.service';
import { ProjectsService } from '../projects/projects.service';

const delegatedTaskInclude = {
  executor: true,
  project: true,
  comments: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' as const },
  },
  events: {
    orderBy: { createdAt: 'desc' as const },
    take: 30,
  },
} as const;

export type DelegatedTaskDetails = Prisma.DelegatedTaskGetPayload<{
  include: typeof delegatedTaskInclude;
}>;

export interface CreateDelegatedTaskInput {
  executorId: string;
  projectId?: string | null;
  title: string;
  description?: string | null;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  dueAt?: Date | null;
}

export type UpdateDelegatedTaskInput = Partial<CreateDelegatedTaskInput> & {
  status?:
    | 'DRAFT'
    | 'SENT'
    | 'ACCEPTED'
    | 'IN_PROGRESS'
    | 'QUESTION'
    | 'WAITING_REVIEW'
    | 'RETURNED'
    | 'COMPLETED'
    | 'CANCELLED';
  resultText?: string | null;
};

@Injectable()
export class DelegatedTasksService {
  private readonly api: Api;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly executors: ExecutorsService,
    private readonly projects: ProjectsService,
  ) {
    this.api = new Api(config.getOrThrow<string>('TELEGRAM_BOT_TOKEN'));
  }

  list(ownerId: string, filters: {
    executorId?: string;
    projectId?: string;
    status?: string;
    priority?: string;
    search?: string;
  } = {}): Promise<DelegatedTaskDetails[]> {
    return this.prisma.delegatedTask.findMany({
      where: {
        ownerId,
        deletedAt: null,
        ...(filters.executorId ? { executorId: filters.executorId } : {}),
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.priority ? { priority: filters.priority as never } : {}),
        ...(filters.search
          ? {
              OR: [
                { title: { contains: filters.search, mode: 'insensitive' } },
                {
                  description: {
                    contains: filters.search,
                    mode: 'insensitive',
                  },
                },
                {
                  executor: {
                    fullName: {
                      contains: filters.search,
                      mode: 'insensitive',
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: delegatedTaskInclude,
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getOwned(ownerId: string, taskId: string): Promise<DelegatedTaskDetails> {
    const task = await this.prisma.delegatedTask.findFirst({
      where: { id: taskId, ownerId, deletedAt: null },
      include: delegatedTaskInclude,
    });
    if (!task) throw new NotFoundException('Delegated task not found.');
    return task;
  }

  async getForExecutor(
    telegramId: string,
    taskId: string,
  ): Promise<DelegatedTaskDetails> {
    const executor = await this.executors.findConnectedByTelegramId(telegramId);
    if (!executor) throw new NotFoundException('Executor not connected.');
    const task = await this.prisma.delegatedTask.findFirst({
      where: {
        id: taskId,
        executorId: executor.id,
        deletedAt: null,
      },
      include: delegatedTaskInclude,
    });
    if (!task) throw new NotFoundException('Delegated task not found.');
    return task;
  }

  async create(
    ownerId: string,
    input: CreateDelegatedTaskInput,
  ): Promise<DelegatedTaskDetails> {
    const title = input.title.trim();
    if (!title) throw new BadRequestException('Task title is required.');
    await this.executors.getOwned(ownerId, input.executorId);
    if (input.projectId) await this.projects.getOwned(ownerId, input.projectId);

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.delegatedTask.create({
        data: {
          ownerId,
          executorId: input.executorId,
          projectId: input.projectId ?? null,
          title,
          description: input.description?.trim() || null,
          priority: input.priority ?? 'NORMAL',
          dueAt: input.dueAt ?? null,
        },
      });
      await tx.delegatedTaskEvent.create({
        data: {
          taskId: created.id,
          ownerId,
          executorId: input.executorId,
          type: 'CREATED',
          title,
        },
      });
      return created;
    });
    return this.getOwned(ownerId, task.id);
  }

  async update(
    ownerId: string,
    taskId: string,
    input: UpdateDelegatedTaskInput,
  ): Promise<DelegatedTaskDetails> {
    const existing = await this.getOwned(ownerId, taskId);
    if (input.executorId) await this.executors.getOwned(ownerId, input.executorId);
    if (input.projectId) await this.projects.getOwned(ownerId, input.projectId);
    if (input.title !== undefined && !input.title.trim()) {
      throw new BadRequestException('Task title is required.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.delegatedTask.update({
        where: { id: taskId },
        data: {
          ...(input.executorId !== undefined
            ? { executorId: input.executorId }
            : {}),
          ...(input.projectId !== undefined
            ? { projectId: input.projectId }
            : {}),
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.description !== undefined
            ? { description: input.description?.trim() || null }
            : {}),
          ...(input.resultText !== undefined
            ? { resultText: input.resultText?.trim() || null }
            : {}),
          ...(input.priority !== undefined ? { priority: input.priority } : {}),
          ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
          ...(input.status !== undefined
            ? {
                status: input.status,
                cancelledAt: input.status === 'CANCELLED' ? new Date() : existing.cancelledAt,
                completedAt: input.status === 'COMPLETED' ? new Date() : existing.completedAt,
              }
            : {}),
        },
      });
      await tx.delegatedTaskEvent.create({
        data: {
          taskId,
          ownerId,
          executorId: input.executorId ?? existing.executorId,
          type: input.executorId ? 'REASSIGNED' : 'UPDATED',
          title: input.title?.trim() || existing.title,
          metadata: { status: input.status ?? existing.status },
        },
      });
    });
    return this.getOwned(ownerId, taskId);
  }

  async softDelete(ownerId: string, taskId: string): Promise<void> {
    await this.getOwned(ownerId, taskId);
    await this.prisma.delegatedTask.update({
      where: { id: taskId },
      data: { deletedAt: new Date() },
    });
  }

  async send(ownerId: string, taskId: string): Promise<DelegatedTaskDetails> {
    const task = await this.getOwned(ownerId, taskId);
    if (!task.executor.telegramUserId || task.executor.connectionStatus !== 'CONNECTED') {
      throw new BadRequestException('Executor is not connected to Telegram.');
    }

    await this.api.sendMessage(
      task.executor.telegramUserId.toString(),
      this.formatExecutorTask(task),
      { reply_markup: this.executorKeyboard(task.id, task.status) },
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.delegatedTask.update({
        where: { id: taskId },
        data: { status: 'SENT', sentAt: new Date() },
      });
      await tx.delegatedTaskEvent.create({
        data: {
          taskId,
          ownerId,
          executorId: task.executorId,
          type: 'SENT',
          title: task.title,
        },
      });
    });
    return this.getOwned(ownerId, taskId);
  }

  async remind(ownerId: string, taskId: string): Promise<DelegatedTaskDetails> {
    const task = await this.getOwned(ownerId, taskId);
    if (!task.executor.telegramUserId) {
      throw new BadRequestException('Executor is not connected to Telegram.');
    }
    await this.api.sendMessage(
      task.executor.telegramUserId.toString(),
      ['Напоминание по задаче', '', this.formatExecutorTask(task)].join('\n'),
      { reply_markup: this.executorKeyboard(task.id, task.status) },
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.delegatedTask.update({
        where: { id: taskId },
        data: { lastReminderAt: new Date() },
      });
      await tx.delegatedTaskEvent.create({
        data: {
          taskId,
          ownerId,
          executorId: task.executorId,
          type: 'REMINDED',
          title: task.title,
        },
      });
    });
    return this.getOwned(ownerId, taskId);
  }

  async ownerComment(
    ownerId: string,
    taskId: string,
    message: string,
  ): Promise<DelegatedTaskDetails> {
    const task = await this.getOwned(ownerId, taskId);
    const text = message.trim();
    if (!text) throw new BadRequestException('Comment is required.');
    await this.addComment(task.id, ownerId, task.executorId, 'OWNER', text);
    if (task.executor.telegramUserId) {
      await this.api.sendMessage(
        task.executor.telegramUserId.toString(),
        [`Комментарий по задаче: ${task.title}`, '', text].join('\n'),
        { reply_markup: this.executorKeyboard(task.id, task.status) },
      );
    }
    return this.getOwned(ownerId, taskId);
  }

  async executorTransition(
    telegramId: string,
    taskId: string,
    action: 'accept' | 'start' | 'question' | 'done',
    message?: string,
  ): Promise<DelegatedTaskDetails> {
    const task = await this.getForExecutor(telegramId, taskId);
    const now = new Date();
    const next = this.nextExecutorStatus(task.status, action);
    const comment = message?.trim();
    return this.prisma.$transaction(async (tx) => {
      await tx.delegatedTask.update({
        where: { id: task.id },
        data: {
          status: next.status,
          ...(next.status === 'ACCEPTED' ? { acceptedAt: now } : {}),
          ...(next.status === 'IN_PROGRESS' ? { startedAt: now } : {}),
          ...(next.status === 'WAITING_REVIEW'
            ? { submittedAt: now, resultText: comment || task.resultText }
            : {}),
        },
      });
      if (comment) {
        await tx.delegatedTaskComment.create({
          data: {
            taskId: task.id,
            ownerId: task.ownerId,
            executorId: task.executorId,
            author: 'EXECUTOR',
            message: comment,
          },
        });
      }
      await tx.delegatedTaskEvent.create({
        data: {
          taskId: task.id,
          ownerId: task.ownerId,
          executorId: task.executorId,
          type: next.event,
          title: task.title,
          metadata: comment ? { message: comment } : undefined,
        },
      });
      return tx.delegatedTask.findUniqueOrThrow({
        where: { id: task.id },
        include: delegatedTaskInclude,
      });
    });
  }

  async ownerReview(
    ownerId: string,
    taskId: string,
    action: 'accept' | 'return',
    message?: string,
  ): Promise<DelegatedTaskDetails> {
    const task = await this.getOwned(ownerId, taskId);
    if (task.status !== 'WAITING_REVIEW') {
      throw new BadRequestException('Task is not waiting for review.');
    }
    const text = message?.trim();
    const status = action === 'accept' ? 'COMPLETED' : 'RETURNED';
    await this.prisma.$transaction(async (tx) => {
      await tx.delegatedTask.update({
        where: { id: taskId },
        data: {
          status,
          completedAt: action === 'accept' ? new Date() : null,
          returnedAt: action === 'return' ? new Date() : task.returnedAt,
        },
      });
      if (text) {
        await tx.delegatedTaskComment.create({
          data: {
            taskId,
            ownerId,
            executorId: task.executorId,
            author: 'OWNER',
            message: text,
          },
        });
      }
      await tx.delegatedTaskEvent.create({
        data: {
          taskId,
          ownerId,
          executorId: task.executorId,
          type: action === 'accept' ? 'ACCEPTED_BY_OWNER' : 'RETURNED',
          title: task.title,
          metadata: text ? { message: text } : undefined,
        },
      });
    });
    if (task.executor.telegramUserId) {
      await this.api.sendMessage(
        task.executor.telegramUserId.toString(),
        action === 'accept'
          ? `Задача принята владельцем: ${task.title}`
          : [`Задача возвращена в работу: ${task.title}`, '', text ?? 'Без комментария.'].join('\n'),
        { reply_markup: this.executorKeyboard(task.id, status) },
      );
    }
    return this.getOwned(ownerId, taskId);
  }

  dueReminders(now = new Date()) {
    return this.prisma.delegatedTask.findMany({
      where: {
        deletedAt: null,
        dueAt: { lte: now },
        status: { in: ['SENT', 'ACCEPTED', 'IN_PROGRESS', 'QUESTION', 'RETURNED'] },
        executor: { telegramUserId: { not: null }, isActive: true },
      },
      include: { executor: true, project: true },
      take: 50,
      orderBy: { dueAt: 'asc' },
    });
  }

  async sendOverdueReminder(task: Prisma.DelegatedTaskGetPayload<{ include: { executor: true; project: true } }>) {
    if (!task.executor.telegramUserId) return;
    const last = task.lastReminderAt?.getTime() ?? 0;
    if (Date.now() - last < 24 * 60 * 60 * 1000) return;
    await this.api.sendMessage(
      task.executor.telegramUserId.toString(),
      ['Просроченная делегированная задача', '', this.formatExecutorTask(task)].join('\n'),
      { reply_markup: this.executorKeyboard(task.id, task.status) },
    );
    await this.prisma.delegatedTask.update({
      where: { id: task.id },
      data: { lastReminderAt: new Date() },
    });
  }

  private async addComment(
    taskId: string,
    ownerId: string,
    executorId: string,
    author: 'OWNER' | 'EXECUTOR' | 'SYSTEM',
    message: string,
  ) {
    await this.prisma.delegatedTaskComment.create({
      data: { taskId, ownerId, executorId, author, message },
    });
  }

  private nextExecutorStatus(
    current: string,
    action: 'accept' | 'start' | 'question' | 'done',
  ) {
    if (action === 'accept' && ['SENT', 'RETURNED'].includes(current)) {
      return { status: 'ACCEPTED' as const, event: 'ACCEPTED' as const };
    }
    if (action === 'start' && ['SENT', 'ACCEPTED', 'RETURNED'].includes(current)) {
      return { status: 'IN_PROGRESS' as const, event: 'STARTED' as const };
    }
    if (action === 'question' && ['SENT', 'ACCEPTED', 'IN_PROGRESS', 'RETURNED', 'QUESTION'].includes(current)) {
      return { status: 'QUESTION' as const, event: 'QUESTION_ASKED' as const };
    }
    if (action === 'done' && ['ACCEPTED', 'IN_PROGRESS', 'QUESTION', 'RETURNED'].includes(current)) {
      return { status: 'WAITING_REVIEW' as const, event: 'SUBMITTED' as const };
    }
    throw new BadRequestException('This status transition is not allowed.');
  }

  private executorKeyboard(taskId: string, status: string): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    if (['SENT', 'RETURNED'].includes(status)) {
      keyboard.text('Принять', `delegated:accept:${taskId}`).row();
    }
    if (['SENT', 'ACCEPTED', 'RETURNED'].includes(status)) {
      keyboard.text('Начать', `delegated:start:${taskId}`).row();
    }
    if (!['COMPLETED', 'CANCELLED', 'WAITING_REVIEW'].includes(status)) {
      keyboard
        .text('Вопрос', `delegated:question:${taskId}`)
        .text('Выполнено', `delegated:done:${taskId}`);
    }
    return keyboard;
  }

  private formatExecutorTask(task: {
    title: string;
    description: string | null;
    priority: string;
    dueAt: Date | null;
    project?: { name: string } | null;
  }): string {
    return [
      `Задача: ${task.title}`,
      task.description ? `Описание: ${task.description}` : null,
      `Приоритет: ${task.priority}`,
      task.dueAt ? `Срок: ${task.dueAt.toLocaleString('ru-RU')}` : null,
      task.project ? `Проект: ${task.project.name}` : null,
    ].filter(Boolean).join('\n');
  }
}
