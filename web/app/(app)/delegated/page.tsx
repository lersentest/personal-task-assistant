'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Clock3, Send, UserRoundCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DelegatedTaskModalLink } from '@/components/delegated-task-detail-modal';
import { Page } from '@/components/page';
import { EmptyPanel, ErrorState, LoadingState, UiCard } from '@/components/ui-kit';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/labels';
import type { DelegatedTask, DelegatedTaskStatus } from '@/lib/types';

const delegatedStatusLabel: Record<DelegatedTaskStatus, string> = {
  DRAFT: 'Черновик',
  SENT: 'Ожидает исполнителя',
  ACCEPTED: 'В работе',
  IN_PROGRESS: 'В работе',
  QUESTION: 'Есть вопрос',
  WAITING_REVIEW: 'На проверке',
  RETURNED: 'В работе',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
};

type DelegatedQueue = 'ATTENTION' | 'WORKING' | 'OVERDUE' | 'DRAFT' | 'COMPLETED' | 'CANCELLED' | 'ALL';

const queues: Array<{ label: string; value: DelegatedQueue; description: string }> = [
  { label: 'Требуют внимания', value: 'ATTENTION', description: 'Вопросы и задачи на проверке' },
  { label: 'В работе', value: 'WORKING', description: 'Ожидают исполнителя или выполняются' },
  { label: 'Просроченные', value: 'OVERDUE', description: 'Срок уже прошёл, задача не закрыта' },
  { label: 'Черновики', value: 'DRAFT', description: 'Ещё не отправлены' },
  { label: 'Завершённые', value: 'COMPLETED', description: 'Приняты владельцем' },
  { label: 'Отменённые', value: 'CANCELLED', description: 'Остановлены владельцем' },
  { label: 'Все', value: 'ALL', description: 'Полный список без статуса' },
];

export default function DelegatedPage() {
  const [filters, setFilters] = useState<{ queue: DelegatedQueue; executorId: string }>({ queue: 'ATTENTION', executorId: '' });
  const executors = useQuery({ queryKey: ['executors'], queryFn: api.executors });
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.executorId) params.set('executorId', filters.executorId);
    return params.toString() ? `?${params.toString()}` : '';
  }, [filters]);
  const tasks = useQuery({ queryKey: ['delegated-tasks', query], queryFn: () => api.delegatedTasks(query) });

  const visibleTasks = useMemo(() => {
    const data = tasks.data ?? [];
    const now = Date.now();
    if (filters.queue === 'ATTENTION') {
      return data.filter((task) => ['QUESTION', 'WAITING_REVIEW'].includes(task.status));
    }
    if (filters.queue === 'WORKING') {
      return data.filter((task) => ['SENT', 'ACCEPTED', 'IN_PROGRESS', 'RETURNED'].includes(task.status));
    }
    if (filters.queue === 'OVERDUE') {
      return data.filter((task) => isOverdue(task, now));
    }
    if (filters.queue === 'ALL') return data;
    return data.filter((task) => task.status === filters.queue);
  }, [filters.queue, tasks.data]);

  const counts = useMemo(() => {
    const data = tasks.data ?? [];
    const now = Date.now();
    return {
      ATTENTION: data.filter((task) => ['QUESTION', 'WAITING_REVIEW'].includes(task.status)).length,
      WORKING: data.filter((task) => ['SENT', 'ACCEPTED', 'IN_PROGRESS', 'RETURNED'].includes(task.status)).length,
      OVERDUE: data.filter((task) => isOverdue(task, now)).length,
      DRAFT: data.filter((task) => task.status === 'DRAFT').length,
      COMPLETED: data.filter((task) => task.status === 'COMPLETED').length,
      CANCELLED: data.filter((task) => task.status === 'CANCELLED').length,
      ALL: data.length,
    } satisfies Record<DelegatedQueue, number>;
  }, [tasks.data]);

  const queueStats = useMemo(() => {
    const data = tasks.data ?? [];
    const now = Date.now();
    return [
      {
        label: 'Требуют внимания',
        value: data.filter((task) => ['QUESTION', 'WAITING_REVIEW'].includes(task.status)).length,
        icon: <AlertCircle size={18} />,
        tone: 'red',
        queue: 'ATTENTION' as const,
      },
      {
        label: 'В работе',
        value: data.filter((task) => ['SENT', 'ACCEPTED', 'IN_PROGRESS', 'RETURNED'].includes(task.status)).length,
        icon: <UserRoundCheck size={18} />,
        tone: 'blue',
        queue: 'WORKING' as const,
      },
      {
        label: 'Просрочены',
        value: data.filter((task) => isOverdue(task, now)).length,
        icon: <Clock3 size={18} />,
        tone: 'red',
        queue: 'OVERDUE' as const,
      },
      {
        label: 'Завершены',
        value: data.filter((task) => task.status === 'COMPLETED').length,
        icon: <CheckCircle2 size={18} />,
        tone: 'green',
        queue: 'COMPLETED' as const,
      },
    ];
  }, [tasks.data]);

  const selectedQueue = queues.find((item) => item.value === filters.queue);

  return (
    <Page
      title="Делегированные"
      description="Отдельный поток задач для исполнителей: вопросы, проверка, работа, сроки и файлы."
    >
      <div className="grid gap-3 md:grid-cols-4">
        {queueStats.map((item) => (
          <button
            key={item.queue}
            type="button"
            onClick={() => setFilters((value) => ({ ...value, queue: item.queue }))}
            className={`group rounded-3xl border bg-[var(--focus-surface,var(--panel))] p-4 text-left shadow-sm transition active:scale-[0.99] ${
              filters.queue === item.queue
                ? 'border-[var(--accent)] ring-2 ring-[var(--accent-soft)]'
                : 'border-[var(--focus-border,var(--line))] hover:-translate-y-0.5 hover:border-[var(--accent)]'
            }`}
          >
            <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-2xl ${metricTone(item.tone)}`}>
              {item.icon}
            </span>
            <span className="block text-sm text-[var(--muted)]">{item.label}</span>
            <span className="mt-1 block text-2xl font-semibold">{item.value}</span>
          </button>
        ))}
      </div>

      <UiCard className="mt-5 overflow-hidden">
        <div className="border-b border-[var(--focus-border-soft,var(--line))] px-3 pt-3">
          <div className="flex gap-1 overflow-x-auto">
            {queues.map((queue) => (
              <button
                key={queue.value}
                type="button"
                onClick={() => setFilters((value) => ({ ...value, queue: queue.value }))}
                className={`whitespace-nowrap rounded-t-2xl px-4 py-3 text-sm font-semibold ${
                  filters.queue === queue.value
                    ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
                    : 'text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]'
                }`}
              >
                {queue.label}
                <span className="ml-2 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs text-[var(--accent)]">
                  {counts[queue.value]}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 p-3 md:grid-cols-[1fr_auto] md:items-center">
          <p className="text-sm text-[var(--muted)]">
            {selectedQueue?.description ?? 'Фильтр делегированных задач'}
          </p>
          <select
            value={filters.executorId}
            onChange={(event) => setFilters((value) => ({ ...value, executorId: event.target.value }))}
            className="h-10 rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm"
          >
            <option value="">Все исполнители</option>
            {executors.data?.map((executor) => <option key={executor.id} value={executor.id}>{executor.fullName}</option>)}
          </select>
        </div>
      </UiCard>

      <div className="mt-5">
        {tasks.isLoading ? <LoadingState text="Загружаю делегированные задачи…" /> : null}
        {tasks.error ? <ErrorState text={`Не удалось загрузить делегированные: ${tasks.error.message}`} /> : null}
        {!tasks.isLoading && !tasks.error && visibleTasks.length === 0 ? (
          <EmptyPanel title="В этой очереди задач нет" text="Можно сменить очередь или создать делегированную задачу через общий «+ Создать»." />
        ) : null}
        {visibleTasks.length ? (
          <UiCard className="overflow-hidden">
            <div className="hidden overflow-x-auto md:block">
              <table className="focus-table w-full text-sm">
                <thead>
                  <tr>
                    <th className="p-4">Исполнитель</th>
                    <th className="p-4">Задача</th>
                    <th className="p-4">Проект</th>
                    <th className="p-4">Срок</th>
                    <th className="p-4">Статус</th>
                    <th className="p-4">Активность</th>
                    <th className="w-12 p-4" />
                  </tr>
                </thead>
                <tbody>
                  {visibleTasks.map((task) => <DelegatedRow key={task.id} task={task} />)}
                </tbody>
              </table>
            </div>
            <div className="grid gap-2 p-3 md:hidden">
              {visibleTasks.map((task) => <DelegatedMobileRow key={task.id} task={task} />)}
            </div>
          </UiCard>
        ) : null}
      </div>

    </Page>
  );
}

function isOverdue(task: DelegatedTask, now = Date.now()) {
  return Boolean(task.dueAt && new Date(task.dueAt).getTime() < now && !['COMPLETED', 'CANCELLED'].includes(task.status));
}

function metricTone(tone: string) {
  if (tone === 'red') return 'bg-red-50 text-red-600 dark:bg-red-950/35 dark:text-red-200';
  if (tone === 'green') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-200';
  return 'bg-blue-50 text-blue-700 dark:bg-blue-950/35 dark:text-blue-200';
}

function DelegatedRow({ task }: { task: DelegatedTask }) {
  const unread = task.comments?.filter((comment) => comment.author === 'EXECUTOR').length ?? 0;
  return (
    <tr className="task-row transition">
      <td className="p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]">
            {task.executor.fullName.slice(0, 1).toUpperCase()}
          </span>
          <span className="font-medium">{task.executor.fullName}</span>
        </div>
      </td>
      <td className="min-w-[260px] p-4">
        <DelegatedTaskModalLink task={task} className="text-left font-semibold hover:text-[var(--accent)]">
          {task.title}
        </DelegatedTaskModalLink>
        {unread ? <p className="mt-1 text-xs text-[var(--accent)]">{unread} комментариев от исполнителя</p> : null}
      </td>
      <td className="p-4 text-[var(--muted)]">{task.project?.name ?? 'Без проекта'}</td>
      <td className="whitespace-nowrap p-4 text-[var(--muted)]">{formatDate(task.dueAt)}</td>
      <td className="p-4"><DelegatedStatus status={task.status} /></td>
      <td className="whitespace-nowrap p-4 text-[var(--muted)]">{formatDate(task.updatedAt)}</td>
      <td className="p-4">
        <DelegatedTaskModalLink task={task} className="rounded-xl p-2 text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]">
          <Send size={17} />
        </DelegatedTaskModalLink>
      </td>
    </tr>
  );
}

function DelegatedMobileRow({ task }: { task: DelegatedTask }) {
  return (
    <DelegatedTaskModalLink
      task={task}
      className="rounded-2xl border border-[var(--focus-border-soft,var(--line))] bg-[var(--focus-surface-secondary,var(--background))] p-3 text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{task.title}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {task.executor.fullName} · {task.project?.name ?? 'Без проекта'} · {formatDate(task.dueAt)}
          </p>
        </div>
        <DelegatedStatus status={task.status} />
      </div>
    </DelegatedTaskModalLink>
  );
}

function DelegatedStatus({ status }: { status: DelegatedTaskStatus }) {
  const tone =
    status === 'COMPLETED'
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-200'
      : status === 'WAITING_REVIEW'
        ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/35 dark:text-violet-200'
        : status === 'QUESTION'
          ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/35 dark:text-orange-200'
          : status === 'CANCELLED'
            ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            : 'bg-blue-50 text-blue-700 dark:bg-blue-950/35 dark:text-blue-200';
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{delegatedStatusLabel[status]}</span>;
}
