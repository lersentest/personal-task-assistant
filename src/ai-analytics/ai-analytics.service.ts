import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { analyticsSchemaPrompt } from './analytics-schema';
import {
  AnalyticsSqlResult,
  AnalyticsSqlService,
} from './analytics-sql.service';

type MessageRole = 'USER' | 'ASSISTANT';

export interface AiAnalyticsArtifact {
  type: 'table' | 'chart';
  title: string;
  columns?: string[];
  rows?: Record<string, unknown>[];
  rowCount?: number;
  truncated?: boolean;
  chartType?: 'bar' | 'line';
  xKey?: string;
  yKey?: string;
  data?: Array<Record<string, string | number | null>>;
}

interface SendMessageInput {
  conversationId?: string | null;
  content: string;
}

interface StoredMessage {
  id: string;
  role: MessageRole;
  content: string;
  model: string | null;
  artifacts: unknown;
  metadata: unknown;
  createdAt: Date;
}

@Injectable()
export class AiAnalyticsService {
  private readonly logger = new Logger(AiAnalyticsService.name);
  private readonly client: OpenAI;
  private readonly fastModel: string;
  private readonly smartModel: string;
  private readonly maxToolCalls: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sql: AnalyticsSqlService,
    config: ConfigService,
  ) {
    this.client = new OpenAI({
      apiKey: config.getOrThrow<string>('OPENAI_API_KEY'),
    });

    const defaultModel =
      config.get<string>('OPENAI_TEXT_MODEL')?.trim() || 'gpt-5.4-mini';
    this.fastModel =
      config.get<string>('AI_ANALYTICS_FAST_MODEL')?.trim() || defaultModel;
    this.smartModel =
      config.get<string>('AI_ANALYTICS_SMART_MODEL')?.trim() || defaultModel;
    this.maxToolCalls = this.numberFromConfig(
      config.get<string>('AI_ANALYTICS_MAX_TOOL_CALLS'),
      4,
      1,
      10,
    );
  }

  async currentConversation(ownerId: string) {
    const conversation = await this.findOrCreateConversation(ownerId);
    return this.toConversationDto(conversation);
  }

  async sendMessage(ownerId: string, timezone: string, input: SendMessageInput) {
    const content = input.content.trim();
    if (!content) throw new BadRequestException('Message is empty.');
    if (content.length > 8000) {
      throw new BadRequestException('Message is too long.');
    }

    const conversation = input.conversationId
      ? await this.getOwnedConversation(ownerId, input.conversationId)
      : await this.findOrCreateConversation(ownerId);

    await this.prisma.aiAnalyticsMessage.create({
      data: {
        conversationId: conversation.id,
        ownerId,
        role: 'USER',
        content,
      },
    });

    const history = await this.prisma.aiAnalyticsMessage.findMany({
      where: { conversationId: conversation.id, ownerId },
      orderBy: { createdAt: 'asc' },
      take: 60,
    });

    const model = this.chooseModel(content);
    const toolResults: AnalyticsSqlResult[] = [];
    const startedAt = Date.now();

    try {
      const answer = await this.askOpenAi({
        ownerId,
        timezone,
        model,
        history: history.map((message) => ({
          role: message.role as MessageRole,
          content: message.content,
        })),
        toolResults,
      });

      const artifacts = this.artifactsFromResults(toolResults);

      await this.prisma.aiAnalyticsMessage.create({
        data: {
          conversationId: conversation.id,
          ownerId,
          role: 'ASSISTANT',
          content: answer,
          model,
          artifacts: artifacts as unknown as Prisma.InputJsonValue,
          metadata: {
            durationMs: Date.now() - startedAt,
            toolCalls: toolResults.length,
            sqlQueries: toolResults.map((result) => ({
              sql: result.sql,
              referencedViews: result.referencedViews,
              rowCount: result.rowCount,
              truncated: result.truncated,
              durationMs: result.durationMs,
            })),
          },
        },
      });

      await this.prisma.aiAnalyticsConversation.update({
        where: { id: conversation.id },
        data: {
          title:
            conversation.title === 'AI-чат'
              ? this.titleFromMessage(content)
              : conversation.title,
        },
      });

      return this.currentConversation(ownerId);
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : 'AI analytics failed');

      const message =
        error instanceof ServiceUnavailableException
          ? 'AI-чат пока не настроен до конца: нет отдельного read-only подключения к аналитической базе.'
          : 'Не удалось получить ответ AI-чата. Попробуй ещё раз или задай вопрос проще.';

      await this.prisma.aiAnalyticsMessage.create({
        data: {
          conversationId: conversation.id,
          ownerId,
          role: 'ASSISTANT',
          content: message,
          model,
          metadata: {
            durationMs: Date.now() - startedAt,
            failed: true,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      });

      return this.currentConversation(ownerId);
    }
  }

  private async askOpenAi(input: {
    ownerId: string;
    timezone: string;
    model: string;
    history: Array<{ role: MessageRole; content: string }>;
    toolResults: AnalyticsSqlResult[];
  }) {
    let response = await this.client.responses.create({
      model: input.model,
      store: false,
      tools: [this.sqlToolDefinition()],
      input: [
        {
          role: 'system',
          content: this.systemPrompt(input.timezone),
        },
        ...input.history.slice(-20).map((message) => ({
          role: message.role === 'USER' ? 'user' : 'assistant',
          content: message.content,
        })),
      ],
    } as never);

    for (let index = 0; index < this.maxToolCalls; index += 1) {
      const calls = this.functionCalls(response);
      if (!calls.length) return this.outputText(response);

      const outputs = [];
      for (const call of calls) {
        if (call.name !== 'execute_analytics_sql') {
          outputs.push({
            type: 'function_call_output',
            call_id: call.call_id,
            output: JSON.stringify({
              ok: false,
              error: `Unknown tool: ${call.name}`,
            }),
          });
          continue;
        }

        const args = this.parseToolArguments(call.arguments);
        try {
          const result = await this.sql.execute(input.ownerId, args.sql);
          input.toolResults.push(result);
          outputs.push({
            type: 'function_call_output',
            call_id: call.call_id,
            output: JSON.stringify({
              ok: true,
              purpose: args.purpose,
              columns: result.columns,
              rows: result.rows,
              rowCount: result.rowCount,
              truncated: result.truncated,
              referencedViews: result.referencedViews,
            }),
          });
        } catch (error) {
          outputs.push({
            type: 'function_call_output',
            call_id: call.call_id,
            output: JSON.stringify({
              ok: false,
              error: error instanceof Error ? error.message : 'SQL failed',
            }),
          });
        }
      }

      response = await this.client.responses.create({
        model: input.model,
        store: false,
        previous_response_id: response.id,
        tools: [this.sqlToolDefinition()],
        input: outputs,
      } as never);
    }

    return this.outputText(response);
  }

  private systemPrompt(timezone: string) {
    return [
      'Ты аналитический AI-чат внутри Personal Task Assistant.',
      'Отвечай по-русски, кратко и по делу, но объясняй метод расчёта.',
      'Для фактов по системе используй инструмент execute_analytics_sql.',
      'Ты не имеешь права изменять данные. Если пользователь просит удалить, обновить, создать или изменить данные — откажись и объясни, что этот чат пока только аналитический.',
      'Не придумывай числа. Если данных нет или поле не фиксируется системой, прямо скажи об этом.',
      'SQL должен быть только SELECT или WITH ... SELECT и только к представлениям ai_analytics.*.',
      'Не выбирай user_id и не пытайся фильтровать по чужим пользователям: backend сам изолирует данные текущего владельца.',
      'Если вопрос подразумевает таблицу, верни текстовый вывод и укажи, какие данные были использованы; таблица будет показана интерфейсом автоматически.',
      `Текущая timezone пользователя: ${timezone}. Текущая дата: ${new Date().toISOString()}.`,
      analyticsSchemaPrompt,
    ].join('\n');
  }

  private sqlToolDefinition() {
    return {
      type: 'function',
      name: 'execute_analytics_sql',
      description:
        'Safely executes one read-only SELECT query against ai_analytics views for the current owner.',
      strict: true,
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          sql: {
            type: 'string',
            description:
              'One SELECT or WITH ... SELECT statement using only fully qualified ai_analytics views.',
          },
          purpose: {
            type: 'string',
            description: 'Short human-readable reason for this query.',
          },
        },
        required: ['sql', 'purpose'],
      },
    };
  }

  private functionCalls(response: unknown) {
    const output = (response as { output?: unknown[] }).output ?? [];
    return output
      .filter((item): item is { type: string; name: string; call_id: string; arguments: string } => {
        const candidate = item as {
          type?: string;
          name?: string;
          call_id?: string;
          arguments?: string;
        };
        return (
          candidate.type === 'function_call' &&
          typeof candidate.name === 'string' &&
          typeof candidate.call_id === 'string' &&
          typeof candidate.arguments === 'string'
        );
      });
  }

  private parseToolArguments(value: string): { sql: string; purpose: string } {
    try {
      const parsed = JSON.parse(value) as { sql?: unknown; purpose?: unknown };
      if (typeof parsed.sql !== 'string') throw new Error('sql is missing');
      return {
        sql: parsed.sql,
        purpose:
          typeof parsed.purpose === 'string' ? parsed.purpose : 'SQL-запрос',
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid tool arguments',
      );
    }
  }

  private outputText(response: unknown) {
    const direct = (response as { output_text?: string }).output_text;
    if (direct?.trim()) return direct.trim();

    const output = (response as { output?: Array<{ content?: Array<{ text?: string }> }> })
      .output ?? [];
    const text = output
      .flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter(Boolean)
      .join('\n')
      .trim();

    return text || 'Я не смог сформировать текстовый ответ по этим данным.';
  }

  private artifactsFromResults(results: AnalyticsSqlResult[]): AiAnalyticsArtifact[] {
    return results.flatMap((result, index) => {
      const table: AiAnalyticsArtifact = {
        type: 'table',
        title: this.artifactTitle(result, index),
        columns: result.columns,
        rows: result.rows,
        rowCount: result.rowCount,
        truncated: result.truncated,
      };
      const chart = this.chartFromResult(result, index);
      return chart ? [table, chart] : [table];
    });
  }

  private artifactTitle(result: AnalyticsSqlResult, index: number) {
    const views = result.referencedViews.length
      ? result.referencedViews.join(', ')
      : 'результат';
    return `Запрос ${index + 1}: ${views}`;
  }

  private chartFromResult(
    result: AnalyticsSqlResult,
    index: number,
  ): AiAnalyticsArtifact | null {
    if (result.rows.length < 2 || result.rows.length > 30) return null;

    const numericKeys = result.columns.filter((column) =>
      result.rows.some((row) => this.toNumber(row[column]) !== null),
    );
    const labelKeys = result.columns.filter((column) => !numericKeys.includes(column));

    const yKey = numericKeys[0];
    const xKey = labelKeys[0] ?? result.columns.find((column) => column !== yKey);
    if (!xKey || !yKey) return null;

    const data = result.rows
      .map((row) => ({
        [xKey]: String(row[xKey] ?? '—'),
        [yKey]: this.toNumber(row[yKey]),
      }))
      .filter((row) => row[yKey] !== null) as Array<
      Record<string, string | number | null>
    >;

    if (data.length < 2) return null;

    return {
      type: 'chart',
      title: `График ${index + 1}`,
      chartType: this.looksLikeDateColumn(xKey) ? 'line' : 'bar',
      xKey,
      yKey,
      data,
    };
  }

  private looksLikeDateColumn(key: string) {
    return key.includes('date') || key.endsWith('_at') || key.includes('month');
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private chooseModel(content: string) {
    const text = content.toLowerCase();
    const complex =
      content.length > 220 ||
      [
        'сравни',
        'динамик',
        'продуктив',
        'закономер',
        'почему',
        'проанализ',
        'месяц',
        'квартал',
        'график',
        'таблиц',
        'тенденц',
        'корреляц',
      ].some((keyword) => text.includes(keyword));

    return complex ? this.smartModel : this.fastModel;
  }

  private async findOrCreateConversation(ownerId: string) {
    const existing = await this.prisma.aiAnalyticsConversation.findFirst({
      where: { ownerId, archivedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (existing) return existing;

    return this.prisma.aiAnalyticsConversation.create({
      data: { ownerId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  private async getOwnedConversation(ownerId: string, conversationId: string) {
    const conversation = await this.prisma.aiAnalyticsConversation.findFirst({
      where: { id: conversationId, ownerId, archivedAt: null },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) throw new BadRequestException('Conversation not found.');
    return conversation;
  }

  private async toConversationDto(conversation: {
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    messages: StoredMessage[];
  }) {
    const fresh = await this.prisma.aiAnalyticsConversation.findUniqueOrThrow({
      where: { id: conversation.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    return {
      id: fresh.id,
      title: fresh.title,
      createdAt: fresh.createdAt,
      updatedAt: fresh.updatedAt,
      messages: fresh.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        model: message.model,
        artifacts: message.artifacts,
        metadata: message.metadata,
        createdAt: message.createdAt,
      })),
    };
  }

  private titleFromMessage(content: string) {
    const clean = content.replace(/\s+/g, ' ').trim();
    return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean || 'AI-чат';
  }

  private numberFromConfig(
    value: string | undefined,
    fallback: number,
    min: number,
    max: number,
  ) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(parsed)));
  }
}
