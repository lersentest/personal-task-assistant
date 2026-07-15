import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DateTime } from 'luxon';
import { Bot, Context, InlineKeyboard } from 'grammy';
import { AiCommand, AiCommandService } from '../ai/ai-command.service';
import { DelegatedTasksService } from '../delegated-tasks/delegated-tasks.service';
import { ExecutorsService } from '../executors/executors.service';
import { ProjectsService } from '../projects/projects.service';
import { RemindersService } from '../reminders/reminders.service';
import { TagsService } from '../tags/tags.service';
import { TaskDetails, TasksService } from '../tasks/tasks.service';
import { TaskView } from '../tasks/types/task-view';
import { UpdateTaskInput } from '../tasks/types/update-task.input';
import { TelegramUserProfile } from '../users/types/telegram-user-profile';
import { UsersService } from '../users/users.service';
import { ConfirmationService } from './confirmation.service';
import { DraftsService } from './drafts.service';
import { confirmationKeyboard } from './keyboards/confirmation.keyboard';
import { MENU_KEYBOARD } from './keyboards/menu.keyboard';
import {
  deletedTaskKeyboard,
  priorityKeyboard,
  taskKeyboard,
} from './keyboards/task.keyboard';
import { TelegramAccessService } from './telegram-access.service';
import { TelegramStateService } from './telegram-state.service';
import {
  formatTask,
  priorityLabel,
  statusLabel,
} from './task.presentation';
import {
  ParsedProjectInput,
  ParsedTaskInput,
  ParsedTextCommand,
  TextCommandParserService,
} from './text-command-parser.service';

const VALID_VIEWS = new Set<TaskView>([
  'TODAY',
  'OVERDUE',
  'UPCOMING',
  'ALL',
  'COMPLETED',
  'CANCELLED',
  'TRASH',
]);

@Injectable()
export class TelegramService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(TelegramService.name);
  private bot?: Bot<Context>;

  constructor(
    private readonly config: ConfigService,
    private readonly access: TelegramAccessService,
    private readonly users: UsersService,
    private readonly executors: ExecutorsService,
    private readonly delegatedTasks: DelegatedTasksService,
    private readonly projects: ProjectsService,
    private readonly tasks: TasksService,
    private readonly tags: TagsService,
    private readonly reminders: RemindersService,
    private readonly ai: AiCommandService,
    private readonly drafts: DraftsService,
    private readonly confirmation: ConfirmationService,
    private readonly state: TelegramStateService,
    private readonly parser: TextCommandParserService,
  ) {}

  onApplicationBootstrap(): void {
    const bot = new Bot<Context>(
      this.config.getOrThrow<string>('TELEGRAM_BOT_TOKEN'),
    );
    this.bot = bot;
    bot.use(this.access.createMiddleware());
    this.registerHandlers(bot);
    bot.catch((error) => this.logger.error(this.errorMessage(error.error)));
    void bot
      .start({
        onStart: (botInfo) =>
          this.logger.log(`Telegram bot @${botInfo.username} started`),
      })
      .catch((error: unknown) => this.logger.error(this.errorMessage(error)));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.bot?.isRunning()) await this.bot.stop();
  }

  private registerHandlers(bot: Bot<Context>): void {
    bot.command('start', async (ctx) => {
      const payload = typeof ctx.match === 'string' ? ctx.match.trim() : '';
      if (this.executors.isInviteToken(payload)) {
        await this.handleExecutorInviteStart(ctx, payload);
        return;
      }
      if (!this.access.isAllowed(ctx.from?.id)) {
        await ctx.reply('Вы подключены как исполнитель. Используйте кнопки под назначенными задачами.');
        return;
      }
      await this.users.ensureTelegramUser(this.profile(ctx));
      await ctx.reply(
        [
          'Personal Task Assistant готов.',
          '',
          'Можно выбрать действие в меню, написать задачу обычным текстом или отправить голосовое сообщение.',
        ].join('\n'),
        { reply_markup: MENU_KEYBOARD },
      );
    });

    bot.command('menu', async (ctx) => {
      await ctx.reply('Меню', { reply_markup: MENU_KEYBOARD });
    });

    this.registerDelegatedTaskHandlers(bot);
    this.registerMenuHandlers(bot);
    this.registerDraftHandlers(bot);
    this.registerViewHandlers(bot);
    this.registerTaskHandlers(bot);
    this.registerProjectAndTagHandlers(bot);

    bot.on('message:voice', async (ctx) => {
      try {
        if (!this.access.isAllowed(ctx.from?.id)) {
          await ctx.reply('Голосовые команды доступны только владельцу. Для делегированных задач используйте кнопки под задачей.');
          return;
        }
        if ((ctx.message.voice.file_size ?? 0) > 20 * 1024 * 1024) {
          throw new BadRequestException(
            'Голосовое сообщение слишком большое. Максимум 20 МБ.',
          );
        }
        await ctx.reply('🎙 Распознаю голосовое сообщение…');
        const file = await ctx.api.getFile(ctx.message.voice.file_id);
        if (!file.file_path) {
          throw new BadRequestException('Telegram не вернул файл сообщения.');
        }
        const token = this.config.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
        const response = await fetch(
          `https://api.telegram.org/file/bot${token}/${file.file_path}`,
        );
        if (!response.ok) {
          throw new BadRequestException('Не удалось загрузить голосовой файл.');
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        const text = await this.ai.transcribe(bytes, 'telegram-voice.ogg', 'audio/ogg');
        await ctx.reply(`Распознано: ${text}`);
        const telegramId = this.telegramId(ctx);
        const mode = this.state.get(telegramId);
        const selectedTaskId =
          mode === 'EDIT_TASK' ? this.state.taskId(telegramId) : undefined;
        const forcedAction =
          mode === 'CREATE_PROJECT'
            ? 'CREATE_PROJECT'
            : mode === 'CREATE_TASK'
              ? 'CREATE_TASK'
              : mode === 'EDIT_TASK'
                ? 'UPDATE_TASK'
                : undefined;
        this.state.clear(telegramId);
        await this.handleNaturalLanguage(
          ctx,
          text,
          'VOICE',
          forcedAction,
          selectedTaskId,
        );
      } catch (error: unknown) {
        await ctx.reply(this.userFacingError(error));
      }
    });

    bot.on('message:text', async (ctx) => {
      const text = ctx.message.text.trim();
      const telegramId = this.telegramId(ctx);
      const mode = this.state.get(telegramId);

      try {
        if (!this.access.isAllowed(ctx.from?.id)) {
          await ctx.reply('Сообщение получено. Для действий по делегированной задаче используйте кнопки под сообщением задачи.');
          return;
        }
        if (mode === 'SEARCH_TASKS') {
          this.state.clear(telegramId);
          await this.showTaskList(ctx, 'ALL', { search: text });
          return;
        }

        const selectedTaskId =
          mode === 'EDIT_TASK' ? this.state.taskId(telegramId) : undefined;
        const forcedAction =
          mode === 'CREATE_PROJECT'
            ? 'CREATE_PROJECT'
            : mode === 'CREATE_TASK'
              ? 'CREATE_TASK'
              : mode === 'EDIT_TASK'
                ? 'UPDATE_TASK'
                : undefined;
        this.state.clear(telegramId);
        await this.handleNaturalLanguage(
          ctx,
          text,
          'TEXT',
          forcedAction,
          selectedTaskId,
        );
      } catch (error: unknown) {
        await ctx.reply(this.userFacingError(error), {
          reply_markup: MENU_KEYBOARD,
        });
      }
    });
  }

  private registerDelegatedTaskHandlers(bot: Bot<Context>): void {
    bot.callbackQuery(/^delegated:(accept|start|question|done):(.+)$/, async (ctx) => {
      try {
        if (!ctx.from) throw new BadRequestException('Telegram user is missing.');
        const [, action, taskId] = ctx.match;
        const message =
          action === 'question'
            ? 'Исполнитель задал вопрос.'
            : action === 'done'
              ? 'Исполнитель отметил задачу выполненной.'
              : undefined;
        const task = await this.delegatedTasks.executorTransition(
          String(ctx.from.id),
          taskId,
          action as 'accept' | 'start' | 'question' | 'done',
          message,
        );
        await ctx.answerCallbackQuery();
        await ctx.reply(
          action === 'done'
            ? 'Задача отправлена владельцу на проверку.'
            : `Статус обновлён: ${task.status}`,
        );
      } catch (error: unknown) {
        await ctx.answerCallbackQuery({
          text: this.userFacingError(error),
          show_alert: true,
        });
      }
    });
  }

  private async handleExecutorInviteStart(ctx: Context, token: string): Promise<void> {
    if (!ctx.from) throw new BadRequestException('Telegram user is missing from update');
    const executor = await this.executors.connectByInvite(token, {
      telegramId: String(ctx.from.id),
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
    });
    await ctx.reply(
      [
        'Telegram успешно подключён.',
        '',
        `${executor.fullName}, теперь вы будете получать здесь назначенные задачи и напоминания.`,
      ].join('\n'),
    );
  }

  private registerMenuHandlers(bot: Bot<Context>): void {
    const viewButtons: Array<[string, TaskView]> = [
      ['Сегодня', 'TODAY'],
      ['Просроченные', 'OVERDUE'],
      ['Ближайшие', 'UPCOMING'],
      ['Все задачи', 'ALL'],
    ];
    for (const [label, view] of viewButtons) {
      bot.hears(label, async (ctx) => {
        try {
          await this.showTaskList(ctx, view);
        } catch (error: unknown) {
          await ctx.reply(this.userFacingError(error));
        }
      });
    }

    bot.hears(['Новая задача', 'Создать задачу'], async (ctx) => {
      this.state.set(this.telegramId(ctx), 'CREATE_TASK');
      await ctx.reply(
        'Опишите задачу обычным текстом: название, проект, срок, приоритет, теги и напоминание.',
      );
    });

    bot.hears(['Новый проект', 'Создать проект'], async (ctx) => {
      this.state.set(this.telegramId(ctx), 'CREATE_PROJECT');
      await ctx.reply('Введите название и при необходимости описание проекта.');
    });

    bot.hears('Проекты', async (ctx) => {
      try {
        await this.showProjects(ctx);
      } catch (error: unknown) {
        await ctx.reply(this.userFacingError(error));
      }
    });

    bot.hears('Теги', async (ctx) => {
      try {
        await this.showTags(ctx);
      } catch (error: unknown) {
        await ctx.reply(this.userFacingError(error));
      }
    });

    bot.hears('Поиск', async (ctx) => {
      this.state.set(this.telegramId(ctx), 'SEARCH_TASKS');
      await ctx.reply('Введите часть названия задачи, описания или проекта.');
    });

    bot.hears('Отмена', async (ctx) => {
      this.state.clear(this.telegramId(ctx));
      await ctx.reply('Текущее действие отменено.', {
        reply_markup: MENU_KEYBOARD,
      });
    });
  }

  private registerDraftHandlers(bot: Bot<Context>): void {
    bot.callbackQuery(/^draft:(?:confirm|cancel):/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const [prefix, action, draftId] = ctx.callbackQuery.data.split(':');
      if (prefix !== 'draft' || !draftId) return;
      const ownerTelegramId = this.telegramId(ctx);
      try {
        if (action === 'cancel') {
          this.confirmation.cancel(draftId, ownerTelegramId);
          await ctx.editMessageText('Действие отменено.');
          return;
        }
        if (action !== 'confirm') return;
        const result = await this.confirmation.confirm(
          draftId,
          ownerTelegramId,
          this.profile(ctx),
        );
        if (result.kind === 'PROJECT') {
          await ctx.editMessageText(`Проект «${result.name}» создан.`);
        } else if (result.kind === 'TASK_UPDATE') {
          await ctx.editMessageText(`Задача «${result.title}» изменена.`);
        } else if (result.kind === 'BULK_TASK_UPDATE') {
          await ctx.editMessageText(
            `Групповое действие выполнено. Изменено задач: ${result.count}.`,
          );
        } else {
          await ctx.editMessageText(
            `Задача «${result.title}» создана.\nПроект: ${result.projectName ?? 'Без проекта'}`,
          );
        }
      } catch (error: unknown) {
        await ctx.reply(this.userFacingError(error));
      }
    });
  }

  private registerViewHandlers(bot: Bot<Context>): void {
    bot.callbackQuery(/^view:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const view = ctx.callbackQuery.data.split(':')[1] as TaskView;
      if (!VALID_VIEWS.has(view)) return;
      try {
        await this.showTaskList(ctx, view);
      } catch (error: unknown) {
        await ctx.reply(this.userFacingError(error));
      }
    });
  }

  private registerTaskHandlers(bot: Bot<Context>): void {
    bot.callbackQuery(/^task:open:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      try {
        const task = await this.ownedTask(ctx, ctx.callbackQuery.data.split(':')[2]);
        await ctx.editMessageText(
          formatTask(task, await this.timezone(ctx)),
          {
            reply_markup: task.deletedAt
              ? deletedTaskKeyboard(task.id)
              : taskKeyboard(task.id),
          },
        );
      } catch (error: unknown) {
        await ctx.reply(this.userFacingError(error));
      }
    });

    bot.callbackQuery(/^task:edit:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const taskId = ctx.callbackQuery.data.split(':')[2];
      try {
        const task = await this.ownedTask(ctx, taskId);
        this.state.set(this.telegramId(ctx), 'EDIT_TASK', task.id);
        await ctx.reply(
          `Что изменить в задаче «${task.title}»? Можно написать или отправить голосовое сообщение.`,
        );
      } catch (error: unknown) {
        await ctx.reply(this.userFacingError(error));
      }
    });

    bot.callbackQuery(/^task:status:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const [, , taskId, status] = ctx.callbackQuery.data.split(':');
      if (!['NEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)) return;
      try {
        const user = await this.ensureUser(ctx);
        const task = await this.tasks.update(user.id, taskId, {
          status: status as UpdateTaskInput['status'],
        });
        await ctx.editMessageText(formatTask(task, user.timezone), {
          reply_markup: taskKeyboard(task.id),
        });
      } catch (error: unknown) {
        await ctx.reply(this.userFacingError(error));
      }
    });

    bot.callbackQuery(/^task:prioritymenu:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const taskId = ctx.callbackQuery.data.split(':')[2];
      try {
        await this.ownedTask(ctx, taskId);
        await ctx.editMessageReplyMarkup({
          reply_markup: priorityKeyboard(taskId),
        });
      } catch (error: unknown) {
        await ctx.reply(this.userFacingError(error));
      }
    });

    bot.callbackQuery(/^task:priority:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const [, , taskId, priority] = ctx.callbackQuery.data.split(':');
      if (!['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(priority)) return;
      try {
        const user = await this.ensureUser(ctx);
        const task = await this.tasks.update(user.id, taskId, {
          priority: priority as UpdateTaskInput['priority'],
        });
        await ctx.editMessageText(formatTask(task, user.timezone), {
          reply_markup: taskKeyboard(task.id),
        });
      } catch (error: unknown) {
        await ctx.reply(this.userFacingError(error));
      }
    });

    bot.callbackQuery(/^task:snooze:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      try {
        const user = await this.ensureUser(ctx);
        const taskId = ctx.callbackQuery.data.split(':')[2];
        const remindAt = await this.reminders.snooze(user.id, taskId);
        await ctx.reply(
          `Напомню через час — ${DateTime.fromJSDate(remindAt).setZone(user.timezone).toFormat('HH:mm')}.`,
        );
      } catch (error: unknown) {
        await ctx.reply(this.userFacingError(error));
      }
    });

    bot.callbackQuery(/^task:delete:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      try {
        const user = await this.ensureUser(ctx);
        const taskId = ctx.callbackQuery.data.split(':')[2];
        await this.tasks.softDelete(user.id, taskId);
        await this.reminders.cancelPending(taskId);
        await ctx.editMessageText('Задача перемещена в корзину.', {
          reply_markup: deletedTaskKeyboard(taskId),
        });
      } catch (error: unknown) {
        await ctx.reply(this.userFacingError(error));
      }
    });

    bot.callbackQuery(/^task:restore:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      try {
        const user = await this.ensureUser(ctx);
        const task = await this.tasks.restore(
          user.id,
          ctx.callbackQuery.data.split(':')[2],
        );
        await ctx.editMessageText(formatTask(task, user.timezone), {
          reply_markup: taskKeyboard(task.id),
        });
      } catch (error: unknown) {
        await ctx.reply(this.userFacingError(error));
      }
    });
  }

  private registerProjectAndTagHandlers(bot: Bot<Context>): void {
    bot.callbackQuery(/^project:open:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      try {
        const user = await this.ensureUser(ctx);
        const projectId = ctx.callbackQuery.data.split(':')[2];
        const project = await this.projects.getOwned(user.id, projectId);
        const keyboard = new InlineKeyboard()
          .text('Активные задачи', `project:tasks:${project.id}`)
          .row()
          .text('Активный', `project:status:${project.id}:ACTIVE`)
          .text('На паузе', `project:status:${project.id}:ON_HOLD`)
          .row()
          .text('Завершён', `project:status:${project.id}:COMPLETED`)
          .text('Архив', `project:status:${project.id}:ARCHIVED`);
        await ctx.editMessageText(
          [
            `📁 Проект: ${project.name}`,
            '',
            `Описание: ${project.description ?? 'Не указано'}`,
            `Статус: ${project.status}`,
            `Всего задач: ${project._count.tasks}`,
          ].join('\n'),
          { reply_markup: keyboard },
        );
      } catch (error: unknown) {
        await ctx.reply(this.userFacingError(error));
      }
    });

    bot.callbackQuery(/^project:tasks:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      try {
        await this.showTaskList(ctx, 'ALL', {
          projectId: ctx.callbackQuery.data.split(':')[2],
        });
      } catch (error: unknown) {
        await ctx.reply(this.userFacingError(error));
      }
    });

    bot.callbackQuery(/^project:status:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const [, , projectId, status] = ctx.callbackQuery.data.split(':');
      if (!['ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'].includes(status)) return;
      try {
        const user = await this.ensureUser(ctx);
        const project = await this.projects.update(user.id, projectId, {
          status: status as 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED',
        });
        await ctx.editMessageText(
          `Проект «${project.name}»: статус ${project.status}.`,
        );
      } catch (error: unknown) {
        await ctx.reply(this.userFacingError(error));
      }
    });

    bot.callbackQuery(/^tag:open:/, async (ctx) => {
      await ctx.answerCallbackQuery();
      try {
        const user = await this.ensureUser(ctx);
        const tagId = ctx.callbackQuery.data.split(':')[2];
        const tag = await this.tags.getOwned(user.id, tagId);
        await ctx.reply(`Задачи с тегом #${tag.name}`);
        await this.showTaskList(ctx, 'ALL', { tagId });
      } catch (error: unknown) {
        await ctx.reply(this.userFacingError(error));
      }
    });
  }

  private async handleNaturalLanguage(
    ctx: Context,
    text: string,
    sourceType: 'TEXT' | 'VOICE',
    forcedAction?: 'CREATE_TASK' | 'CREATE_PROJECT' | 'UPDATE_TASK',
    selectedTaskId?: string,
  ): Promise<void> {
    const user = await this.ensureUser(ctx);
    const selectedTask = selectedTaskId
      ? await this.tasks.getOwned(user.id, selectedTaskId)
      : undefined;
    const projects = await this.projects.list(user.id);

    let command: AiCommand;
    try {
      command = await this.ai.parse(text, {
        timezone: user.timezone,
        projectNames: projects.map((project) => project.name),
        ...(forcedAction ? { forcedAction } : {}),
        ...(selectedTask ? { selectedTaskTitle: selectedTask.title } : {}),
      });
    } catch (error: unknown) {
      const fallback = this.fallbackParse(text, forcedAction);
      if (!fallback) throw error;
      await this.showDraft(ctx, this.telegramId(ctx), fallback);
      return;
    }

    if (command.action === 'CREATE_PROJECT') {
      if (!command.title) throw new BadRequestException('Укажите название проекта.');
      await this.showProjectDraft(ctx, this.telegramId(ctx), {
        kind: 'PROJECT',
        name: command.title,
        ...(command.description ? { description: command.description } : {}),
      });
      return;
    }

    if (command.action === 'CREATE_TASK') {
      if (!command.title) throw new BadRequestException('Укажите название задачи.');
      await this.showTaskDraft(ctx, this.telegramId(ctx), {
        kind: 'TASK',
        title: command.title,
        ...(command.projectName ? { projectName: command.projectName } : {}),
        ...(command.description !== null
          ? { description: command.description }
          : {}),
        ...(command.priority ? { priority: command.priority } : {}),
        ...(command.dueAt ? { dueAt: new Date(command.dueAt) } : {}),
        ...(command.dueDateType
          ? { dueDateType: command.dueDateType }
          : {}),
        ...(command.remindAt
          ? { remindAt: new Date(command.remindAt) }
          : {}),
        tags: command.tags,
        sourceType,
        originalText: text,
      });
      return;
    }

    if (command.action === 'UPDATE_TASK') {
      await this.showUpdateDraft(ctx, user.id, command, selectedTask);
      return;
    }

    if (command.action === 'BULK_UPDATE_TASKS') {
      await this.showBulkUpdateDraft(ctx, user.id, user.timezone, command);
      return;
    }

    throw new BadRequestException(
      'Не удалось понять действие. Опишите одну задачу или проект одним сообщением.',
    );
  }

  private async showUpdateDraft(
    ctx: Context,
    ownerId: string,
    command: AiCommand,
    selectedTask?: TaskDetails,
  ): Promise<void> {
    let task = selectedTask;
    if (!task) {
      const candidates = await this.tasks.findCandidates(
        ownerId,
        command.targetQuery ?? '',
      );
      if (candidates.length === 0) {
        throw new NotFoundException('Подходящая задача не найдена.');
      }
      if (candidates.length > 1) {
        const keyboard = new InlineKeyboard();
        for (const candidate of candidates) {
          keyboard.text(candidate.title.slice(0, 45), `task:open:${candidate.id}`).row();
        }
        await ctx.reply(
          'Найдено несколько задач. Откройте нужную, нажмите «Изменить» и повторите изменение.',
          { reply_markup: keyboard },
        );
        return;
      }
      task = candidates[0];
    }

    const fields = new Set(command.updateFields);
    const changes: UpdateTaskInput = {};
    const preview: string[] = [];
    let projectName: string | null | undefined;
    if (fields.has('TITLE') && command.title) {
      changes.title = command.title;
      preview.push(`Название: ${task.title} → ${command.title}`);
    }
    if (fields.has('DESCRIPTION')) {
      changes.description = command.description;
      preview.push(`Описание: ${command.description ?? 'очистить'}`);
    }
    if (fields.has('PROJECT')) {
      projectName = command.projectName;
      preview.push(`Проект: ${command.projectName ?? 'Без проекта'}`);
    }
    if (fields.has('STATUS') && command.status) {
      changes.status = command.status;
      preview.push(`Статус: ${statusLabel(command.status)}`);
    }
    if (fields.has('PRIORITY') && command.priority) {
      changes.priority = command.priority;
      preview.push(`Приоритет: ${priorityLabel(command.priority)}`);
    }
    if (fields.has('DUE_DATE')) {
      changes.dueAt = command.dueAt ? new Date(command.dueAt) : null;
      changes.dueDateType = command.dueDateType;
      preview.push(`Срок: ${command.dueAt ?? 'очистить'}`);
    }
    if (fields.has('REMINDER')) {
      changes.remindAt = command.remindAt ? new Date(command.remindAt) : null;
      preview.push(`Напоминание: ${command.remindAt ?? 'отключить'}`);
    }
    if (fields.has('TAGS')) {
      changes.tags = command.tags;
      preview.push(`Теги: ${command.tags.join(', ') || 'очистить'}`);
    }
    if (preview.length === 0) {
      throw new BadRequestException('Не указано, что изменить в задаче.');
    }

    const draft = this.drafts.createTaskUpdate(this.telegramId(ctx), {
      taskId: task.id,
      ...(projectName !== undefined ? { projectName } : {}),
      changes,
    });
    await ctx.reply(
      ['Изменение задачи', '', `Задача: ${task.title}`, ...preview].join('\n'),
      { reply_markup: confirmationKeyboard(draft.id) },
    );
  }

  private async showBulkUpdateDraft(
    ctx: Context,
    ownerId: string,
    timezone: string,
    command: AiCommand,
  ): Promise<void> {
    const filter = command.bulkFilter ?? {
      projectName: command.projectName,
      search: command.targetQuery,
      tag: null,
      status: null,
      priority: null,
      view: null,
      unassigned: null,
    };
    let projectId: string | null | undefined;
    if (filter.projectName) {
      const project = await this.projects.findActiveByName(ownerId, filter.projectName);
      if (!project) {
        throw new NotFoundException(`РџСЂРѕРµРєС‚ В«${filter.projectName}В» РЅРµ РЅР°Р№РґРµРЅ.`);
      }
      projectId = project.id;
    }

    const tasks = await this.tasks.findBulkCandidates(ownerId, timezone, {
      projectId,
      projectName: filter.projectName,
      search: filter.search ?? command.targetQuery,
      tag: filter.tag,
      status: filter.status,
      priority: filter.priority,
      view: filter.view ?? null,
      unassigned: filter.unassigned,
    });
    if (tasks.length === 0) {
      throw new NotFoundException('РџРѕ РјР°СЃСЃРѕРІРѕР№ РєРѕРјР°РЅРґРµ РЅРµ РЅР°Р№РґРµРЅРѕ Р·Р°РґР°С‡.');
    }

    const { changes, projectName, preview } = this.buildTaskChangesPreview(
      command,
    );
    if (preview.length === 0) {
      throw new BadRequestException('РќРµ СѓРєР°Р·Р°РЅРѕ, С‡С‚Рѕ РёР·РјРµРЅРёС‚СЊ РІ Р·Р°РґР°С‡Р°С….');
    }

    const draft = this.drafts.createBulkTaskUpdate(this.telegramId(ctx), {
      taskIds: tasks.map((task) => task.id),
      taskTitles: tasks.map((task) => task.title),
      ...(projectName !== undefined ? { projectName } : {}),
      changes,
    });
    await ctx.reply(
      [
        'Групповое изменение задач',
        '',
        `Найдено задач: ${tasks.length}`,
        ...tasks.slice(0, 10).map((task, index) => `${index + 1}. ${task.title}`),
        ...(tasks.length > 10 ? [`…и ещё ${tasks.length - 10}`] : []),
        '',
        'Что изменится:',
        ...preview,
      ].join('\n'),
      { reply_markup: confirmationKeyboard(draft.id) },
    );
  }

  private buildTaskChangesPreview(command: AiCommand): {
    changes: UpdateTaskInput;
    projectName: string | null | undefined;
    preview: string[];
  } {
    const fields = new Set(command.updateFields);
    const changes: UpdateTaskInput = {};
    const preview: string[] = [];
    let projectName: string | null | undefined;

    if (fields.has('TITLE') && command.title) {
      changes.title = command.title;
      preview.push(`Название: ${command.title}`);
    }
    if (fields.has('DESCRIPTION')) {
      changes.description = command.description;
      preview.push(`Описание: ${command.description ?? 'очистить'}`);
    }
    if (fields.has('PROJECT')) {
      projectName = command.projectName;
      preview.push(`Проект: ${command.projectName ?? 'Без проекта'}`);
    }
    if (fields.has('STATUS') && command.status) {
      changes.status = command.status;
      preview.push(`Статус: ${statusLabel(command.status)}`);
    }
    if (fields.has('PRIORITY') && command.priority) {
      changes.priority = command.priority;
      preview.push(`Приоритет: ${priorityLabel(command.priority)}`);
    }
    if (fields.has('DUE_DATE')) {
      changes.dueAt = command.dueAt ? new Date(command.dueAt) : null;
      changes.dueDateType = command.dueDateType;
      preview.push(`Срок: ${command.dueAt ?? 'очистить'}`);
    }
    if (fields.has('REMINDER')) {
      changes.remindAt = command.remindAt ? new Date(command.remindAt) : null;
      preview.push(`Напоминание: ${command.remindAt ?? 'отключить'}`);
    }
    if (fields.has('TAGS')) {
      changes.tags = command.tags;
      preview.push(`Теги: ${command.tags.join(', ') || 'очистить'}`);
    }

    return { changes, projectName, preview };
  }

  private async showDraft(
    ctx: Context,
    ownerTelegramId: string,
    parsed: ParsedTextCommand,
  ): Promise<void> {
    if (parsed.kind === 'PROJECT') {
      await this.showProjectDraft(ctx, ownerTelegramId, parsed);
    } else {
      await this.showTaskDraft(ctx, ownerTelegramId, parsed);
    }
  }

  private async showProjectDraft(
    ctx: Context,
    ownerTelegramId: string,
    parsed: ParsedProjectInput,
  ): Promise<void> {
    const draft = this.drafts.createProject(ownerTelegramId, {
      name: parsed.name,
      description: parsed.description,
    });
    await ctx.reply(
      [
        'Новый проект',
        '',
        `Название: ${parsed.name}`,
        `Описание: ${parsed.description ?? 'Не указано'}`,
        'Статус: Активный',
      ].join('\n'),
      { reply_markup: confirmationKeyboard(draft.id) },
    );
  }

  private async showTaskDraft(
    ctx: Context,
    ownerTelegramId: string,
    parsed: ParsedTaskInput,
  ): Promise<void> {
    const draft = this.drafts.createTask(ownerTelegramId, {
      title: parsed.title,
      projectName: parsed.projectName,
      description: parsed.description,
      priority: parsed.priority,
      dueAt: parsed.dueAt,
      dueDateType: parsed.dueDateType,
      remindAt: parsed.remindAt,
      tags: parsed.tags,
      sourceType: parsed.sourceType,
      originalText: parsed.originalText,
    });
    const timezone = await this.timezone(ctx);
    const due = parsed.dueAt
      ? DateTime.fromJSDate(parsed.dueAt).setZone(timezone).toFormat('dd.LL.yyyy HH:mm')
      : 'Не указан';
    const remind = parsed.remindAt
      ? DateTime.fromJSDate(parsed.remindAt).setZone(timezone).toFormat('dd.LL.yyyy HH:mm')
      : 'Не установлено';
    await ctx.reply(
      [
        'Новая задача',
        '',
        `Название: ${parsed.title}`,
        `Проект: ${parsed.projectName ?? 'Без проекта'}`,
        `Описание: ${parsed.description ?? 'Не указано'}`,
        `Срок: ${due}`,
        `Приоритет: ${priorityLabel(parsed.priority ?? 'NORMAL')}`,
        `Теги: ${parsed.tags?.join(', ') || 'Нет'}`,
        `Напоминание: ${remind}`,
      ].join('\n'),
      { reply_markup: confirmationKeyboard(draft.id) },
    );
  }

  private async showTaskList(
    ctx: Context,
    view: TaskView,
    filters: { projectId?: string; tagId?: string; search?: string } = {},
  ): Promise<void> {
    const user = await this.ensureUser(ctx);
    const tasks = await this.tasks.list(user.id, {
      view,
      timezone: user.timezone,
      limit: 20,
      ...filters,
    });
    const title: Record<TaskView, string> = {
      TODAY: 'Сегодня',
      OVERDUE: 'Просроченные',
      UPCOMING: 'Ближайшие 7 дней',
      ALL: filters.search ? `Результаты поиска: ${filters.search}` : 'Все задачи',
      COMPLETED: 'Выполненные',
      CANCELLED: 'Отменённые',
      TRASH: 'Корзина',
    };
    if (tasks.length === 0) {
      await ctx.reply(`${title[view]}: задач нет.`);
      return;
    }
    await ctx.reply(`${title[view]}: ${tasks.length}`);
    for (const task of tasks) {
      await ctx.reply(formatTask(task, user.timezone), {
        reply_markup:
          view === 'TRASH' ? deletedTaskKeyboard(task.id) : taskKeyboard(task.id),
      });
    }
  }

  private async showProjects(ctx: Context): Promise<void> {
    const user = await this.ensureUser(ctx);
    const projects = await this.projects.list(user.id);
    if (projects.length === 0) {
      await ctx.reply('Активных проектов пока нет.');
      return;
    }
    const keyboard = new InlineKeyboard();
    for (const project of projects.slice(0, 30)) {
      keyboard
        .text(
          `${project.name} (${project._count.tasks})`.slice(0, 55),
          `project:open:${project.id}`,
        )
        .row();
    }
    await ctx.reply('Проекты', { reply_markup: keyboard });
  }

  private async showTags(ctx: Context): Promise<void> {
    const user = await this.ensureUser(ctx);
    const tags = await this.tags.list(user.id);
    if (tags.length === 0) {
      await ctx.reply('Тегов пока нет. Укажите их при создании или изменении задачи.');
      return;
    }
    const keyboard = new InlineKeyboard();
    for (const tag of tags.slice(0, 40)) {
      keyboard
        .text(`#${tag.name} (${tag._count.tasks})`.slice(0, 55), `tag:open:${tag.id}`)
        .row();
    }
    await ctx.reply('Теги', { reply_markup: keyboard });
  }

  private fallbackParse(
    text: string,
    forcedAction?: 'CREATE_TASK' | 'CREATE_PROJECT' | 'UPDATE_TASK',
  ): ParsedTextCommand | null {
    if (forcedAction === 'UPDATE_TASK') return null;
    if (forcedAction === 'CREATE_PROJECT') return this.parser.parseProjectInput(text);
    if (forcedAction === 'CREATE_TASK') return this.parser.parseTaskInput(text);
    return this.parser.parseDirectCommand(text);
  }

  private async ensureUser(ctx: Context) {
    return this.users.ensureTelegramUser(this.profile(ctx));
  }

  private async ownedTask(ctx: Context, taskId: string): Promise<TaskDetails> {
    const user = await this.ensureUser(ctx);
    return this.tasks.getOwned(user.id, taskId, true);
  }

  private async timezone(ctx: Context): Promise<string> {
    return (await this.ensureUser(ctx)).timezone;
  }

  private profile(ctx: Context): TelegramUserProfile {
    if (!ctx.from) {
      throw new BadRequestException('Telegram user is missing from update');
    }
    return {
      telegramId: String(ctx.from.id),
      firstName: ctx.from.first_name,
      ...(ctx.from.last_name ? { lastName: ctx.from.last_name } : {}),
      ...(ctx.from.username ? { username: ctx.from.username } : {}),
      ...(ctx.from.language_code
        ? { languageCode: ctx.from.language_code }
        : {}),
    };
  }

  private telegramId(ctx: Context): string {
    if (!ctx.from) {
      throw new BadRequestException('Telegram user is missing from update');
    }
    return String(ctx.from.id);
  }

  private userFacingError(error: unknown): string {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException ||
      error instanceof ConflictException
    ) {
      const response = error.getResponse();
      if (typeof response === 'string') return response;
      return String('message' in response ? response.message : error.message);
    }
    if (this.hasErrorCode(error, 'P2002')) {
      return 'Объект с таким названием уже существует.';
    }
    if (error instanceof HttpException) return error.message;
    this.logger.error(this.errorMessage(error));
    return 'Не удалось выполнить действие. Попробуйте повторить позже.';
  }

  private hasErrorCode(error: unknown, code: string): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === code
    );
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown Telegram error';
  }
}
