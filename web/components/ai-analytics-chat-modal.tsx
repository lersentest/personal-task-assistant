'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Loader2, Send, Sparkles, Table2, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { AiChatArtifact, AiChatConversation, AiChatMessage } from '@/lib/types';

const examplePrompts = [
  'Покажи, какие проекты сейчас самые тяжёлые по количеству открытых задач',
  'Сделай таблицу просроченных задач и сгруппируй по проектам',
  'Какие задачи с файлами есть за последние 30 дней?',
  'Кому я чаще всего делегирую задачи и где зависания?',
];

const MESSAGE_TURN_PAGE_SIZE = 10;

export function AiAnalyticsChatModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [visibleTurns, setVisibleTurns] = useState(MESSAGE_TURN_PAGE_SIZE);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const conversationQuery = useQuery({
    queryKey: ['ai-analytics-conversation'],
    queryFn: api.aiAnalyticsConversation,
    enabled: open,
    staleTime: 15_000,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      api.sendAiAnalyticsMessage({
        conversationId: conversationQuery.data?.id,
        content,
      }),
    onSuccess: (conversation) => {
      queryClient.setQueryData(['ai-analytics-conversation'], conversation);
      setVisibleTurns(MESSAGE_TURN_PAGE_SIZE);
      setMessage('');
    },
  });

  const messages = conversationQuery.data?.messages ?? [];
  const { visibleMessages, hiddenTurnCount } = useMemo(
    () => sliceRecentTurns(messages, visibleTurns),
    [messages, visibleTurns],
  );
  const isBusy = conversationQuery.isLoading || sendMutation.isPending;

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }, 80);
    return () => window.clearTimeout(handle);
  }, [open, messages.length, sendMutation.isPending]);

  useEffect(() => {
    if (open) setVisibleTurns(MESSAGE_TURN_PAGE_SIZE);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  function send(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const content = message.trim();
    if (!content || sendMutation.isPending) return;
    sendMutation.mutate(content);
  }

  function usePrompt(prompt: string) {
    setMessage(prompt);
  }

  function showMoreMessages() {
    const scrollElement = scrollRef.current;
    const previousHeight = scrollElement?.scrollHeight ?? 0;
    setVisibleTurns((value) => value + MESSAGE_TURN_PAGE_SIZE);
    window.requestAnimationFrame(() => {
      if (!scrollElement) return;
      scrollElement.scrollTop = scrollElement.scrollHeight - previousHeight + scrollElement.scrollTop;
    });
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[10080] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <section
        className="flex h-[min(88vh,860px)] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-[var(--focus-border)] bg-[var(--focus-surface)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--focus-border-soft)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <span className="mb-2 inline-flex items-center gap-2 rounded-full bg-[var(--focus-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--focus-primary)]">
              <Sparkles size={14} />
              AI-аналитика
            </span>
            <h2 className="text-2xl font-semibold tracking-tight">AI-чат по системе</h2>
            <p className="mt-1 text-sm text-[var(--focus-text-muted)]">
              Задавай вопросы по задачам, проектам, файлам, чек-листам и делегированию.
              Чат читает данные через безопасный read-only слой.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть AI-чат"
            className="rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface-secondary)] p-2 text-[var(--focus-text-secondary)] transition hover:bg-[var(--focus-primary-soft)] hover:text-[var(--focus-primary)] active:scale-95"
          >
            <X size={20} />
          </button>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {conversationQuery.isError ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Не удалось загрузить историю AI-чата. Попробуй открыть модалку ещё раз.
            </div>
          ) : null}

          {!conversationQuery.isLoading && messages.length === 0 ? (
            <EmptyChat onPrompt={usePrompt} />
          ) : null}

          <div className="grid gap-4">
            {hiddenTurnCount > 0 ? (
              <div className="sticky top-2 z-10 flex justify-center">
                <button
                  type="button"
                  onClick={showMoreMessages}
                  className="rounded-full border border-[var(--focus-border)] bg-[var(--focus-surface)] px-4 py-2 text-sm font-semibold text-[var(--focus-primary)] shadow-lg transition hover:border-[var(--focus-primary)] hover:bg-[var(--focus-primary-soft)] active:scale-[0.98]"
                >
                  Показать ещё {Math.min(MESSAGE_TURN_PAGE_SIZE, hiddenTurnCount)} предыдущих
                </button>
              </div>
            ) : null}
            {visibleMessages.map((item) => (
              <ChatMessage key={item.id} message={item} />
            ))}
            {sendMutation.isPending ? (
              <div className="flex max-w-[86%] items-center gap-3 rounded-3xl border border-[var(--focus-border)] bg-[var(--focus-surface-secondary)] px-4 py-3 text-sm text-[var(--focus-text-muted)]">
                <Loader2 size={16} className="animate-spin" />
                Думаю, проверяю данные и собираю ответ…
              </div>
            ) : null}
          </div>
        </div>

        <form
          onSubmit={send}
          className="border-t border-[var(--focus-border-soft)] bg-[var(--focus-surface-secondary)] p-4 sm:p-5"
        >
          {sendMutation.isError ? (
            <p className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {sendMutation.error instanceof Error
                ? sendMutation.error.message
                : 'Не удалось отправить сообщение.'}
            </p>
          ) : null}
          <div className="flex gap-3">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder="Например: какие проекты сейчас тормозят и почему?"
              className="min-h-[56px] flex-1 resize-none rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface)] px-4 py-3 text-sm outline-none transition focus:border-[var(--focus-primary)] focus:ring-4 focus:ring-blue-500/10"
              rows={2}
              disabled={isBusy}
            />
            <button
              type="submit"
              disabled={!message.trim() || isBusy}
              className="inline-flex h-[56px] items-center justify-center gap-2 rounded-2xl bg-[var(--focus-text)] px-5 text-sm font-semibold text-[var(--focus-surface)] transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {sendMutation.isPending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
              <span className="hidden sm:inline">Отправить</span>
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--focus-text-muted)]">
            Enter — отправить, Shift+Enter — новая строка. История сохраняется и не очищается.
          </p>
        </form>
      </section>
    </div>
  );
}

function EmptyChat({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  return (
    <div className="mb-4 rounded-[1.75rem] border border-[var(--focus-border)] bg-[var(--focus-surface-secondary)] p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--focus-primary-soft)] text-[var(--focus-primary)]">
          <Bot size={20} />
        </span>
        <div>
          <p className="font-semibold">Можно спрашивать обычным языком</p>
          <p className="text-sm text-[var(--focus-text-muted)]">
            Я достану данные, построю таблицу или график и объясню вывод.
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {examplePrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPrompt(prompt)}
            className="rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface)] px-3 py-3 text-left text-sm transition hover:border-[var(--focus-primary)] hover:bg-[var(--focus-primary-soft)] active:scale-[0.99]"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function sliceRecentTurns(messages: AiChatMessage[], visibleTurns: number) {
  if (messages.length <= MESSAGE_TURN_PAGE_SIZE) {
    return { visibleMessages: messages, hiddenTurnCount: 0 };
  }

  const userMessageIndexes = messages
    .map((item, index) => (item.role === 'USER' ? index : -1))
    .filter((index) => index >= 0);

  if (!userMessageIndexes.length) {
    const startIndex = Math.max(0, messages.length - visibleTurns);
    return {
      visibleMessages: messages.slice(startIndex),
      hiddenTurnCount: startIndex,
    };
  }

  const hiddenTurnCount = Math.max(0, userMessageIndexes.length - visibleTurns);
  const startIndex = hiddenTurnCount > 0 ? userMessageIndexes[hiddenTurnCount] : 0;

  return {
    visibleMessages: messages.slice(startIndex),
    hiddenTurnCount,
  };
}

function splitExplanationBlock(content: string) {
  const lines = content.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) =>
    /^#{0,6}\s*(как\s+(я\s+)?определил|как\s+определено|почему\s+так|методика|на\s+основе\s+чего|источники)\s*[:：]?/i.test(line.trim()),
  );

  if (headingIndex < 0) {
    return { main: content, explanation: '' };
  }

  const firstExplanationLine = lines[headingIndex]
    .replace(/^#{0,6}\s*(как\s+(я\s+)?определил|как\s+определено|почему\s+так|методика|на\s+основе\s+чего|источники)\s*[:：]?\s*/i, '')
    .trim();
  const main = lines.slice(0, headingIndex).join('\n').trim();
  const explanation = [firstExplanationLine, ...lines.slice(headingIndex + 1)]
    .filter(Boolean)
    .join('\n')
    .trim();

  return {
    main: main || 'Ответ готов.',
    explanation,
  };
}

function ChatMessage({ message }: { message: AiChatMessage }) {
  const isUser = message.role === 'USER';
  const usage = !isUser ? aiUsage(message.metadata) : null;
  const contentParts = !isUser ? splitExplanationBlock(message.content) : null;

  return (
    <article className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[94%] rounded-[1.65rem] px-4 py-3 shadow-sm sm:max-w-[86%] ${
          isUser
            ? 'bg-[var(--focus-primary)] text-white'
            : 'border border-[var(--focus-border)] bg-[var(--focus-surface-secondary)] text-[var(--focus-text)]'
        }`}
      >
        {contentParts ? (
          <>
            <div className="whitespace-pre-wrap text-sm leading-6">{contentParts.main}</div>
            {contentParts.explanation ? (
              <details className="mt-3 rounded-2xl border border-[var(--focus-border-soft)] bg-[var(--focus-surface)]/75 px-3 py-2 text-sm">
                <summary className="cursor-pointer select-none font-semibold text-[var(--focus-text-secondary)]">
                  Как определил
                </summary>
                <div className="mt-2 whitespace-pre-wrap leading-6 text-[var(--focus-text-muted)]">
                  {contentParts.explanation}
                </div>
              </details>
            ) : null}
          </>
        ) : (
          <div className="whitespace-pre-wrap text-sm leading-6">{message.content}</div>
        )}
        {!isUser && message.artifacts?.length ? (
          <div className="mt-4 grid gap-3">
            {message.artifacts.map((artifact, index) => (
              <ArtifactCard key={`${message.id}-${index}`} artifact={artifact} />
            ))}
          </div>
        ) : null}
        <p className={`mt-2 text-[11px] ${isUser ? 'text-white/70' : 'text-[var(--focus-text-muted)]'}`}>
          {formatDate(message.createdAt)}
          {!isUser && message.model ? ` · ${message.model}` : ''}
          {usage ? ` · ${formatTokens(usage.totalTokens)} токенов` : ''}
          {usage?.estimatedCostUsd !== null && usage?.estimatedCostUsd !== undefined
            ? ` · ~${formatUsd(usage.estimatedCostUsd)}`
            : ''}
        </p>
      </div>
    </article>
  );
}

function ArtifactCard({ artifact }: { artifact: AiChatArtifact }) {
  if (artifact.type === 'chart') {
    return <ChartArtifact artifact={artifact} />;
  }
  return <TableArtifact artifact={artifact} />;
}

function TableArtifact({ artifact }: { artifact: AiChatArtifact }) {
  const columns = artifact.columns ?? inferColumns(artifact.rows ?? []);
  const rows = artifact.rows ?? [];

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface)]">
      <div className="flex items-center gap-2 border-b border-[var(--focus-border-soft)] px-3 py-2">
        <Table2 size={16} className="text-[var(--focus-primary)]" />
        <span className="text-sm font-semibold">{artifact.title}</span>
        <span className="ml-auto text-xs text-[var(--focus-text-muted)]">
          {artifact.rowCount ?? rows.length} строк
        </span>
      </div>
      {rows.length ? (
        <div className="max-h-80 overflow-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
            <thead className="sticky top-0 bg-[var(--focus-surface-secondary)]">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column}
                    className="border-b border-[var(--focus-border-soft)] px-3 py-2 font-semibold text-[var(--focus-text-muted)]"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="odd:bg-[var(--focus-surface)] even:bg-[var(--focus-surface-secondary)]/45">
                  {columns.map((column) => (
                    <td
                      key={column}
                      className="max-w-[260px] border-b border-[var(--focus-border-soft)] px-3 py-2 align-top"
                    >
                      <span className="line-clamp-4">{formatValue(row[column])}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-3 py-4 text-sm text-[var(--focus-text-muted)]">Данных нет.</p>
      )}
      {artifact.truncated ? (
        <p className="border-t border-[var(--focus-border-soft)] px-3 py-2 text-xs text-[var(--focus-text-muted)]">
          Результат усечён до безопасного лимита строк.
        </p>
      ) : null}
    </div>
  );
}

function ChartArtifact({ artifact }: { artifact: AiChatArtifact }) {
  const data = artifact.data ?? [];
  const xKey = artifact.xKey;
  const yKey = artifact.yKey;
  const values = useMemo(
    () =>
      data
        .map((row) => Number(yKey ? row[yKey] : 0))
        .filter((value) => Number.isFinite(value)),
    [data, yKey],
  );
  const max = Math.max(1, ...values);

  if (!xKey || !yKey || data.length < 2) return null;

  return (
    <div className="rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface)] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{artifact.title}</p>
        <p className="text-xs text-[var(--focus-text-muted)]">
          {artifact.chartType === 'line' ? 'Линия' : 'Столбцы'} · {yKey}
        </p>
      </div>
      {artifact.chartType === 'line' ? (
        <LineChart data={data} xKey={xKey} yKey={yKey} max={max} />
      ) : (
        <div className="flex h-48 items-end gap-2 overflow-x-auto rounded-2xl bg-[var(--focus-surface-secondary)] p-3">
          {data.map((row, index) => {
            const value = Number(row[yKey] ?? 0);
            const height = Math.max(8, Math.round((value / max) * 150));
            return (
              <div key={index} className="flex min-w-12 flex-1 flex-col items-center gap-2">
                <span className="text-[11px] font-semibold">{formatValue(value)}</span>
                <span
                  className="w-full max-w-14 rounded-t-xl bg-[var(--focus-primary)]"
                  style={{ height }}
                />
                <span className="line-clamp-2 text-center text-[10px] text-[var(--focus-text-muted)]">
                  {formatValue(row[xKey])}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LineChart({
  data,
  xKey,
  yKey,
  max,
}: {
  data: Array<Record<string, string | number | null>>;
  xKey: string;
  yKey: string;
  max: number;
}) {
  const width = 640;
  const height = 180;
  const padding = 18;
  const points = data.map((row, index) => {
    const x =
      data.length === 1
        ? width / 2
        : padding + (index * (width - padding * 2)) / (data.length - 1);
    const value = Number(row[yKey] ?? 0);
    const y = height - padding - (Math.max(0, value) / max) * (height - padding * 2);
    return `${x},${y}`;
  });

  return (
    <div className="overflow-x-auto rounded-2xl bg-[var(--focus-surface-secondary)] p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-48 min-w-[520px]">
        <polyline
          fill="none"
          stroke="var(--focus-primary)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
          points={points.join(' ')}
        />
        {points.map((point, index) => {
          const [cx, cy] = point.split(',').map(Number);
          return (
            <g key={point}>
              <circle cx={cx} cy={cy} r="5" fill="var(--focus-primary)" />
              <text
                x={cx}
                y={height - 2}
                textAnchor="middle"
                className="fill-[var(--focus-text-muted)] text-[10px]"
              >
                {shortLabel(data[index]?.[xKey])}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function inferColumns(rows: Record<string, unknown>[]) {
  return [...new Set(rows.flatMap((row) => Object.keys(row)))];
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function shortLabel(value: unknown) {
  const label = formatValue(value);
  return label.length > 10 ? `${label.slice(0, 9)}…` : label;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('ru', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function aiUsage(metadata: Record<string, unknown> | null) {
  const usage = metadata?.usage;
  if (!usage || typeof usage !== 'object') return null;
  const value = usage as Record<string, unknown>;
  const totalTokens = toFiniteNumber(value.totalTokens);
  const inputTokens = toFiniteNumber(value.inputTokens);
  const outputTokens = toFiniteNumber(value.outputTokens);
  const estimatedCostUsd = toNullableNumber(value.estimatedCostUsd);
  if (!totalTokens && !inputTokens && !outputTokens) return null;
  return {
    totalTokens,
    inputTokens,
    outputTokens,
    estimatedCostUsd,
  };
}

function toFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toNullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatTokens(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function formatUsd(value: number) {
  return `$${value.toFixed(value < 0.01 ? 5 : 4)}`;
}
