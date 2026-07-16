'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Clock3, MessageSquare, Send, UserRoundCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DelegatedTaskModalLink } from '@/components/delegated-task-detail-modal';
import { Page } from '@/components/page';
import { EmptyPanel, ErrorState, LoadingState, MetricStrip, UiCard } from '@/components/ui-kit';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/labels';
import type { DelegatedTask, DelegatedTaskStatus } from '@/lib/types';

const delegatedStatusLabel: Record<DelegatedTaskStatus, string> = {
  DRAFT: 'Черновик',
  SENT: 'Отправлена',
  ACCEPTED: 'Принята',
  IN_PROGRESS: 'В работе',
  QUESTION: 'Вопрос',
  WAITING_REVIEW: 'На проверке',
  RETURNED: 'Возвращена',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
};

const tabs: Array<{ label: string; value: '' | DelegatedTaskStatus | 'ACTIVE' | 'ATTENTION' }> = [
  { label: 'Активные', value: 'ACTIVE' },
  { label: 'Ожидаю исполнителя', value: 'SENT' },
  { label: 'На проверке', value: 'WAITING_REVIEW' },
  { label: 'Завершённые', value: 'COMPLETED' },
];

export default function DelegatedPage() {
  const [filters, setFilters] = useState({ status: 'ACTIVE', executorId: '' });
  const executors = useQuery({ queryKey: ['executors'], queryFn: api.executors });
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.executorId) params.set('executorId', filters.executorId);
    if (filters.status && filters.status !== 'ACTIVE' && filters.status !== 'ATTENTION') {
      params.set('status', filters.status);
    }
    return params.toString() ? `?${params.toString()}` : '';
  }, [filters]);
  const tasks = useQuery({ queryKey: ['delegated-tasks', query], queryFn: () => api.delegatedTasks(query) });

  const visibleTasks = useMemo(() => {
    const data = tasks.data ?? [];
    if (filters.status === 'ACTIVE') {
      return data.filter((task) => !['COMPLETED', 'CANCELLED'].includes(task.status));
    }
    if (filters.status === 'ATTENTION') {
      return data.filter((task) => ['QUESTION', 'WAITING_REVIEW', 'RETURNED'].includes(task.status));
    }
    return data;
  }, [filters.status, tasks.data]);

  const stats = useMemo(() => {
    const data = tasks.data ?? [];
    const now = Date.now();
    return {
      attention: data.filter((task) => ['QUESTION', 'WAITING_REVIEW', 'RETURNED'].includes(task.status)).length,
      inProgress: data.filter((task) => ['ACCEPTED', 'IN_PROGRESS'].includes(task.status)).length,
      review: data.filter((task) => task.status === 'WAITING_REVIEW').length,
      overdue: data.filter((task) => task.dueAt && new Date(task.dueAt).getTime() < now && !['COMPLETED', 'CANCELLED'].includes(task.status)).length,
    };
  }, [tasks.data]);

  return (
    <Page
      title="Делегированные"
      description="Отдельный поток задач для исполнителей: статус, активность, комментарии и файлы."
    >
      <MetricStrip
        items={[
          { label: 'Требуют внимания', value: stats.attention, icon: <AlertCircle size={18} />, tone: 'red' },
          { label: 'В работе', value: stats.inProgress, icon: <UserRoundCheck size={18} />, tone: 'blue' },
          { label: 'На проверке', value: stats.review, icon: <MessageSquare size={18} />, tone: 'orange' },
          { label: 'Просрочены', value: stats.overdue, icon: <Clock3 size={18} />, tone: 'red' },
        ]}
      />

      <UiCard className="mt-5 overflow-hidden">
        <div className="border-b border-[var(--focus-border-soft,var(--line))] px-3 pt-3">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.label}
                type="button"
                onClick={() => setFilters((value) => ({ ...value, status: tab.value }))}
                className={`whitespace-nowrap rounded-t-2xl px-4 py-3 text-sm font-semibold ${
                  filters.status === tab.value
                    ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
                    : 'text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 p-3 md:grid-cols-[1fr_1fr]">
          <select
            value={filters.status}
            onChange={(event) => setFilters((value) => ({ ...value, status: event.target.value }))}
            className="h-10 rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm"
          >
            <option value="ACTIVE">Все активные</option>
            <option value="ATTENTION">Требуют внимания</option>
            {Object.entries(delegatedStatusLabel).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
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
          <EmptyPanel title="Делегированных задач нет" text="Создай делегированную задачу через общий «+ Создать»." />
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
        : status === 'QUESTION' || status === 'RETURNED'
          ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/35 dark:text-orange-200'
          : status === 'CANCELLED'
            ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            : 'bg-blue-50 text-blue-700 dark:bg-blue-950/35 dark:text-blue-200';
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{delegatedStatusLabel[status]}</span>;
}
