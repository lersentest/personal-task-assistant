import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DateTime } from 'luxon';
import OpenAI, { toFile } from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

const AiCommandSchema = z.object({
  action: z.enum([
    'CREATE_TASK',
    'CREATE_PROJECT',
    'UPDATE_TASK',
    'BULK_UPDATE_TASKS',
    'UNKNOWN',
  ]),
  updateFields: z.array(
    z.enum([
      'TITLE',
      'DESCRIPTION',
      'PROJECT',
      'STATUS',
      'PRIORITY',
      'DUE_DATE',
      'REMINDER',
      'TAGS',
    ]),
  ),
  targetQuery: z.string().nullable(),
  bulkFilter: z
    .object({
      projectName: z.string().nullable(),
      search: z.string().nullable(),
      tag: z.string().nullable(),
      status: z
        .enum(['NEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
        .nullable(),
      priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).nullable(),
      view: z
        .enum([
          'TODAY',
          'OVERDUE',
          'UPCOMING',
          'ALL',
          'COMPLETED',
          'CANCELLED',
          'TRASH',
        ])
        .nullable(),
      unassigned: z.boolean().nullable(),
    })
    .nullable(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  projectName: z.string().nullable(),
  status: z
    .enum(['NEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
    .nullable(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).nullable(),
  dueAt: z.string().nullable(),
  dueDateType: z
    .enum(['ON_DATE', 'BEFORE_DATE', 'EXACT_TIME'])
    .nullable(),
  remindAt: z.string().nullable(),
  tags: z.array(z.string()),
});

export type AiCommand = z.infer<typeof AiCommandSchema>;

@Injectable()
export class AiCommandService {
  private readonly logger = new Logger(AiCommandService.name);
  private readonly client: OpenAI;
  private readonly textModel: string;
  private readonly transcriptionModel: string;

  constructor(config: ConfigService) {
    this.client = new OpenAI({
      apiKey: config.getOrThrow<string>('OPENAI_API_KEY'),
    });
    this.textModel = config.get<string>('OPENAI_TEXT_MODEL') ?? 'gpt-5.4-mini';
    this.transcriptionModel =
      config.get<string>('OPENAI_TRANSCRIPTION_MODEL') ??
      'gpt-4o-mini-transcribe';
  }

  async parse(
    text: string,
    context: {
      timezone: string;
      projectNames: string[];
      forcedAction?: 'CREATE_TASK' | 'CREATE_PROJECT' | 'UPDATE_TASK';
      selectedTaskTitle?: string;
    },
  ): Promise<AiCommand> {
    const now = DateTime.now().setZone(context.timezone);
    const forcedAction = context.forcedAction
      ? `Разрешённое действие: только ${context.forcedAction}.`
      : 'Определи одно действие пользователя.';
    const selectedTask = context.selectedTaskTitle
      ? `Выбрана задача: «${context.selectedTaskTitle}». Для UPDATE_TASK targetQuery должен быть этим названием.`
      : '';

    try {
      const response = await this.client.responses.parse({
        model: this.textModel,
        store: false,
        input: [
          {
            role: 'system',
            content: [
              'Ты преобразуешь команды личного Telegram-бота задач в структурированные данные.',
              forcedAction,
              selectedTask,
              'Bulk task commands are supported. If the user asks to change all/multiple tasks, return BULK_UPDATE_TASKS, set bulkFilter, and set updateFields plus the ordinary update values. Always require an explicit plural/all/multiple-task intent for BULK_UPDATE_TASKS.',
              `Текущее локальное время: ${now.toISO()} (${context.timezone}).`,
              `Существующие проекты: ${context.projectNames.join(', ') || 'нет'}.`,
              'Поддерживаются создание задачи, создание проекта и изменение одной задачи.',
              'Если в сообщении несколько разных задач или действие неясно, верни UNKNOWN.',
              'Для изменения targetQuery — короткая уникальная часть названия задачи.',
              'Для UPDATE_TASK перечисли реально изменяемые поля в updateFields. Null очищает поле только если оно есть в updateFields.',
              'Все даты dueAt и remindAt возвращай как ISO 8601 UTC.',
              'Фраза «в пятницу» означает срок в пятницу; если время не указано, используй 07:00 локального времени и ON_DATE.',
              'Фраза «до пятницы» означает BEFORE_DATE; напоминание — предыдущий день в 09:00.',
              'Если указано точное время, используй EXACT_TIME и напоминание за час, если пользователь не задал другое.',
              'Приоритет по умолчанию NORMAL. Теги возвращай без символа #, максимум 10.',
              'Не придумывай проект, описание, дату или теги, если пользователь их не назвал.',
              'Для проекта title — его название. Не заполняй поля, не относящиеся к действию.',
            ]
              .filter(Boolean)
              .join('\n'),
          },
          { role: 'user', content: text },
        ],
        text: {
          format: zodTextFormat(AiCommandSchema, 'task_command'),
        },
      });

      if (!response.output_parsed) {
        throw new Error('OpenAI returned no structured command');
      }
      return this.normalize(response.output_parsed);
    } catch (error: unknown) {
      this.logger.error(this.errorMessage(error));
      throw new ServiceUnavailableException(
        'OpenAI временно недоступен. Попробуйте ещё раз позже.',
      );
    }
  }

  async transcribe(
    bytes: Uint8Array,
    filename: string,
    mimeType: string,
  ): Promise<string> {
    try {
      const file = await toFile(bytes, filename, { type: mimeType });
      const transcription = await this.client.audio.transcriptions.create({
        file,
        model: this.transcriptionModel,
        response_format: 'text',
        prompt:
          'Личная задача или проект на русском, украинском или английском языке. Сохраняй названия проектов, имена и даты точно.',
      });
      const text =
        typeof transcription === 'string'
          ? transcription
          : ((transcription as unknown as { text?: string }).text ?? '');
      if (!text.trim()) throw new Error('Empty transcription');
      return text.trim();
    } catch (error: unknown) {
      this.logger.error(this.errorMessage(error));
      throw new ServiceUnavailableException(
        'Не удалось распознать голосовое сообщение. Попробуйте ещё раз.',
      );
    }
  }

  private normalize(command: AiCommand): AiCommand {
    return {
      ...command,
      targetQuery: command.targetQuery?.trim() || null,
      title: command.title?.trim() || null,
      description: command.description?.trim() || null,
      projectName: command.projectName?.trim() || null,
      dueAt: this.validIso(command.dueAt),
      remindAt: this.validIso(command.remindAt),
      tags: [...new Set(command.tags.map((tag) => tag.trim()).filter(Boolean))]
        .slice(0, 10)
        .map((tag) => tag.slice(0, 80)),
      bulkFilter: command.bulkFilter
        ? {
            ...command.bulkFilter,
            projectName: command.bulkFilter.projectName?.trim() || null,
            search: command.bulkFilter.search?.trim() || null,
            tag: command.bulkFilter.tag?.trim() || null,
          }
        : null,
    };
  }

  private validIso(value: string | null): string | null {
    if (!value) return null;
    const date = DateTime.fromISO(value, { setZone: true });
    return date.isValid ? date.toUTC().toISO() : null;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown OpenAI error';
  }
}
