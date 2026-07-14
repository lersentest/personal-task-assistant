import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { AiCommand, AiCommandService } from '../ai/ai-command.service';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';
import { UpdateTaskInput } from '../tasks/types/update-task.input';
import { ConfirmationService } from '../telegram/confirmation.service';
import { DraftsService } from '../telegram/drafts.service';
import { TextCommandParserService } from '../telegram/text-command-parser.service';
import { UsersService } from '../users/users.service';
import { TelegramUserProfile } from '../users/types/telegram-user-profile';

type DraftPreview =
  | {
      kind: 'PROJECT';
      draftId: string;
      title: string;
      fields: Array<{ label: string; value: string }>;
    }
  | {
      kind: 'TASK';
      draftId: string;
      title: string;
      fields: Array<{ label: string; value: string }>;
    }
  | {
      kind: 'TASK_UPDATE';
      draftId: string;
      title: string;
      fields: Array<{ label: string; value: string }>;
    }
  | {
      kind: 'BULK_TASK_UPDATE';
      draftId: string;
      title: string;
      fields: Array<{ label: string; value: string }>;
      affectedTasks: string[];
    };

@Injectable()
export class VoiceCommandService {
  constructor(
    private readonly ai: AiCommandService,
    private readonly projects: ProjectsService,
    private readonly tasks: TasksService,
    private readonly users: UsersService,
    private readonly drafts: DraftsService,
    private readonly confirmation: ConfirmationService,
    private readonly parser: TextCommandParserService,
  ) {}

  async interpret(userId: string, text: string, sourceType: 'TEXT' | 'VOICE') {
    const user = await this.userById(userId);
    const ownerTelegramId = String(user.telegramId);
    const projects = await this.projects.list(user.id);
    const trimmed = text.trim();
    if (!trimmed) throw new BadRequestException('Пустая команда.');

    let command: AiCommand | null = null;
    try {
      command = await this.ai.parse(trimmed, {
        timezone: user.timezone,
        projectNames: projects.map((project) => project.name),
      });
    } catch {
      const fallback = this.parser.parseDirectCommand(trimmed);
      if (fallback?.kind === 'PROJECT') {
        return {
          transcript: trimmed,
          draft: this.createProjectDraft(ownerTelegramId, fallback.name, fallback.description),
        };
      }
      if (fallback?.kind === 'TASK') {
        return {
          transcript: trimmed,
          draft: this.createTaskDraft(ownerTelegramId, user.timezone, {
            title: fallback.title,
            projectName: fallback.projectName,
            description: fallback.description,
            priority: fallback.priority,
            dueAt: fallback.dueAt,
            dueDateType: fallback.dueDateType,
            remindAt: fallback.remindAt,
            tags: fallback.tags,
            sourceType,
            originalText: trimmed,
          }),
        };
      }
      throw new BadRequestException('Не удалось понять команду. Попробуйте переформулировать.');
    }

    if (command.action === 'CREATE_PROJECT') {
      if (!command.title) throw new BadRequestException('Укажите название проекта.');
      return {
        transcript: trimmed,
        draft: this.createProjectDraft(
          ownerTelegramId,
          command.title,
          command.description ?? undefined,
        ),
      };
    }

    if (command.action === 'CREATE_TASK') {
      if (!command.title) throw new BadRequestException('Укажите название задачи.');
      return {
        transcript: trimmed,
        draft: this.createTaskDraft(ownerTelegramId, user.timezone, {
          title: command.title,
          ...(command.projectName ? { projectName: command.projectName } : {}),
          ...(command.description !== null ? { description: command.description } : {}),
          ...(command.priority ? { priority: command.priority } : {}),
          ...(command.dueAt ? { dueAt: new Date(command.dueAt) } : {}),
          ...(command.dueDateType ? { dueDateType: command.dueDateType } : {}),
          ...(command.remindAt ? { remindAt: new Date(command.remindAt) } : {}),
          tags: command.tags,
          sourceType,
          originalText: trimmed,
        }),
      };
    }

    if (command.action === 'UPDATE_TASK') {
      return {
        transcript: trimmed,
        draft: await this.createUpdateDraft(ownerTelegramId, user.id, command),
      };
    }

    if (command.action === 'BULK_UPDATE_TASKS') {
      return {
        transcript: trimmed,
        draft: await this.createBulkUpdateDraft(
          ownerTelegramId,
          user.id,
          user.timezone,
          command,
        ),
      };
    }

    throw new BadRequestException('Не удалось понять действие. Опишите одну задачу, проект или изменение.');
  }

  async confirm(userId: string, draftId: string) {
    const user = await this.userById(userId);
    return this.confirmation.confirm(draftId, String(user.telegramId), this.profile(user));
  }

  async cancel(userId: string, draftId: string) {
    const user = await this.userById(userId);
    this.confirmation.cancel(draftId, String(user.telegramId));
    return { ok: true };
  }

  private async createUpdateDraft(
    ownerTelegramId: string,
    ownerId: string,
    command: AiCommand,
  ): Promise<DraftPreview> {
    const candidates = await this.tasks.findCandidates(ownerId, command.targetQuery ?? '');
    if (candidates.length === 0) {
      throw new NotFoundException('Подходящая задача не найдена.');
    }
    if (candidates.length > 1) {
      throw new BadRequestException(
        `Найдено несколько задач: ${candidates
          .slice(0, 5)
          .map((task) => task.title)
          .join(', ')}. Уточните команду.`,
      );
    }
    const task = candidates[0];
    const { changes, projectName, fields } = this.buildTaskChanges(command);
    if (fields.length === 0) {
      throw new BadRequestException('Не указано, что изменить в задаче.');
    }
    const draft = this.drafts.createTaskUpdate(ownerTelegramId, {
      taskId: task.id,
      ...(projectName !== undefined ? { projectName } : {}),
      changes,
    });
    return {
      kind: 'TASK_UPDATE',
      draftId: draft.id,
      title: 'Изменение задачи',
      fields: [{ label: 'Задача', value: task.title }, ...fields],
    };
  }

  private async createBulkUpdateDraft(
    ownerTelegramId: string,
    ownerId: string,
    timezone: string,
    command: AiCommand,
  ): Promise<DraftPreview> {
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
      if (!project) throw new NotFoundException(`Проект «${filter.projectName}» не найден.`);
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
      throw new NotFoundException('По групповой команде не найдено задач.');
    }
    const { changes, projectName, fields } = this.buildTaskChanges(command);
    if (fields.length === 0) {
      throw new BadRequestException('Не указано, что изменить в задачах.');
    }
    const draft = this.drafts.createBulkTaskUpdate(ownerTelegramId, {
      taskIds: tasks.map((task) => task.id),
      taskTitles: tasks.map((task) => task.title),
      ...(projectName !== undefined ? { projectName } : {}),
      changes,
    });
    return {
      kind: 'BULK_TASK_UPDATE',
      draftId: draft.id,
      title: 'Групповое изменение задач',
      fields: [
        { label: 'Найдено задач', value: String(tasks.length) },
        ...fields,
      ],
      affectedTasks: tasks.slice(0, 10).map((task) => task.title),
    };
  }

  private createProjectDraft(
    ownerTelegramId: string,
    name: string,
    description?: string,
  ): DraftPreview {
    const draft = this.drafts.createProject(ownerTelegramId, {
      name,
      ...(description ? { description } : {}),
    });
    return {
      kind: 'PROJECT',
      draftId: draft.id,
      title: 'Новый проект',
      fields: [
        { label: 'Название', value: name },
        { label: 'Описание', value: description ?? 'Не указано' },
        { label: 'Статус', value: 'Активный' },
      ],
    };
  }

  private createTaskDraft(
    ownerTelegramId: string,
    timezone: string,
    payload: Parameters<DraftsService['createTask']>[1],
  ): DraftPreview {
    const draft = this.drafts.createTask(ownerTelegramId, payload);
    return {
      kind: 'TASK',
      draftId: draft.id,
      title: 'Новая задача',
      fields: [
        { label: 'Название', value: payload.title },
        { label: 'Проект', value: payload.projectName ?? 'Без проекта' },
        { label: 'Описание', value: payload.description ?? 'Не указано' },
        { label: 'Срок', value: this.formatDate(payload.dueAt, timezone) },
        { label: 'Приоритет', value: this.priorityLabel(payload.priority ?? 'NORMAL') },
        { label: 'Теги', value: payload.tags?.join(', ') || 'Нет' },
        { label: 'Напоминание', value: this.formatDate(payload.remindAt, timezone) },
      ],
    };
  }

  private buildTaskChanges(command: AiCommand): {
    changes: UpdateTaskInput;
    projectName: string | null | undefined;
    fields: Array<{ label: string; value: string }>;
  } {
    const selected = new Set(command.updateFields);
    const changes: UpdateTaskInput = {};
    const fields: Array<{ label: string; value: string }> = [];
    let projectName: string | null | undefined;

    if (selected.has('TITLE') && command.title) {
      changes.title = command.title;
      fields.push({ label: 'Название', value: command.title });
    }
    if (selected.has('DESCRIPTION')) {
      changes.description = command.description;
      fields.push({ label: 'Описание', value: command.description ?? 'Очистить' });
    }
    if (selected.has('PROJECT')) {
      projectName = command.projectName;
      fields.push({ label: 'Проект', value: command.projectName ?? 'Без проекта' });
    }
    if (selected.has('STATUS') && command.status) {
      changes.status = command.status;
      fields.push({ label: 'Статус', value: this.statusLabel(command.status) });
    }
    if (selected.has('PRIORITY') && command.priority) {
      changes.priority = command.priority;
      fields.push({ label: 'Приоритет', value: this.priorityLabel(command.priority) });
    }
    if (selected.has('DUE_DATE')) {
      changes.dueAt = command.dueAt ? new Date(command.dueAt) : null;
      changes.dueDateType = command.dueDateType;
      fields.push({ label: 'Срок', value: command.dueAt ?? 'Очистить' });
    }
    if (selected.has('REMINDER')) {
      changes.remindAt = command.remindAt ? new Date(command.remindAt) : null;
      fields.push({ label: 'Напоминание', value: command.remindAt ?? 'Отключить' });
    }
    if (selected.has('TAGS')) {
      changes.tags = command.tags;
      fields.push({ label: 'Теги', value: command.tags.join(', ') || 'Очистить' });
    }

    return { changes, projectName, fields };
  }

  private async userById(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('Пользователь не найден.');
    return user;
  }

  private profile(user: Awaited<ReturnType<UsersService['findById']>>): TelegramUserProfile {
    if (!user) throw new NotFoundException('Пользователь не найден.');
    return {
      telegramId: String(user.telegramId),
      firstName: user.firstName,
      ...(user.lastName ? { lastName: user.lastName } : {}),
      ...(user.username ? { username: user.username } : {}),
      ...(user.languageCode ? { languageCode: user.languageCode } : {}),
    };
  }

  private formatDate(date: Date | null | undefined, timezone: string): string {
    return date
      ? DateTime.fromJSDate(date).setZone(timezone).toFormat('dd.LL.yyyy HH:mm')
      : 'Не указано';
  }

  private priorityLabel(priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT') {
    return {
      LOW: 'Низкий',
      NORMAL: 'Обычный',
      HIGH: 'Высокий',
      URGENT: 'Срочный',
    }[priority];
  }

  private statusLabel(status: 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') {
    return {
      NEW: 'Новая',
      IN_PROGRESS: 'В работе',
      COMPLETED: 'Выполнена',
      CANCELLED: 'Отменена',
    }[status];
  }
}
