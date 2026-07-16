'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock3, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { CreateEntityModal, CreateEntityState } from '@/components/create-entity-modal';
import { Page } from '@/components/page';
import { TaskModalLink } from '@/components/task-detail-modal';
import { EmptyPanel, ErrorState, LoadingState, PriorityBadge, StatusBadge, UiCard } from '@/components/ui-kit';
import { api } from '@/lib/api';
import { invalidateTaskCaches } from '@/lib/cache';
import { formatDate } from '@/lib/labels';
import { Task, TaskKind, TaskPriority, TaskStatus } from '@/lib/types';

const quickTabs = [
  { label: 'Все', query: '' },
  { label: 'В работе', query: 'status=IN_PROGRESS' },
  { label: 'Просроченные', query: 'view=OVERDUE' },
  { label: 'Выполненные', query: 'view=COMPLETED' },
  { label: 'Без проекта', query: 'unassigned=true' },
] as const;

const statusOptions: Array<{ label: string; value: '' | TaskStatus }> = [
  { label: 'Все статусы', value: '' },
  { label: 'Новые', value: 'NEW' },
  { label: 'В работе', value: 'IN_PROGRESS' },
  { label: 'Выполненные', value: 'COMPLETED' },
  { label: 'Отменённые', value: 'CANCELLED' },
];

const priorityOptions: Array<{ label: string; value: '' | TaskPriority }> = [
  { label: 'Все приоритеты', value: '' },
  { label: 'Срочные', value: 'URGENT' },
  { label: 'Высокие', value: 'HIGH' },
  { label: 'Обычные', value: 'NORMAL' },
  { label: 'Низкие', value: 'LOW' },
];

function buildQuery(params: URLSearchParams, overrides: Record<string, string | null> = {}) {
  const value = new URLSearchParams(params.toString());
  value.delete('create');
  value.delete('type');
  Object.entries(overrides).forEach(([key, next]) => {
    if (!next) value.delete(key);
    else value.set(key, next);
  });
  return value.toString() ? `?${value.toString()}` : '';
}

function formatMinutes(value: number | null) {
  if (!value) return '—';
  if (value < 60) return `${value} мин`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes ? `${hours} ч ${minutes} мин` : `${hours} ч`;
}

export default function TasksPage() {
  const params = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [createModal, setCreateModal] = useState<CreateEntityState | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [density, setDensity] = useState<'comfortable' | 'compact'>('compact');

  const query = useMemo(() => buildQuery(params), [params]);
  const tasks = useQuery({ queryKey: ['tasks', query], queryFn: () => api.tasks(query) });
  const complete = useMutation({
    mutationFn: api.completeTask,
    onSuccess: (task) => void invalidateTaskCaches(queryClient, task.id),
  });
  const remove = useMutation({
    mutationFn: api.deleteTask,
    onSuccess: (_, taskId) => {
      setSelected([]);
      void invalidateTaskCaches(queryClient, taskId);
    },
  });

  const urlCreateKind = (params.get('type') as TaskKind | null) ?? 'TASK';
  const urlCreateOpen = params.get('create') === '1';
  const allSelected = Boolean(tasks.data?.length) && selected.length === tasks.data?.length;

  function setParam(key: string, value: string) {
    router.push(`/tasks${buildQuery(params, { [key]: value || null })}`);
  }

  function activateTab(queryPart: string) {
    router.push(queryPart ? `/tasks?${queryPart}` : '/tasks');
    setSelected([]);
  }

  function toggleSelection(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function bulkComplete() {
    for (const id of selected) {
      await complete.mutateAsync(id);
    }
    setSelected([]);
  }

  async function bulkDelete() {
    for (const id of selected) {
      await remove.mutateAsync(id);
    }
  }

  return (
    <Page
      title="Задачи"
      description="Компактный рабочий список, фильтры, массовые действия и детали в панели."
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDensity((value) => (value === 'compact' ? 'comfortable' : 'compact'))}
            className="btn-base btn-secondary"
          >
            {density === 'compact' ? 'Плотнее' : 'Комфортно'}
          </button>
          <button
            type="button"
            onClick={() => setCreateModal({ entity: 'task', kind: 'TASK' })}
            className="btn-base btn-primary"
          >
            <Plus size={17} />
            Новая задача
          </button>
        </div>
      }
    >
      <UiCard className="mb-4 overflow-hidden">
        <div className="border-b border-[var(--focus-border-soft,var(--line))] px-3 pt-3">
          <div className="flex gap-1 overflow-x-auto">
            {quickTabs.map((tab) => {
              const active = query.replace(/^\?/, '') === tab.query;
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => activateTab(tab.query)}
                  className={`whitespace-nowrap rounded-t-2xl px-4 py-3 text-sm font-semibold ${
                    active
                      ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
                      : 'text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-3 p-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <select
            value={(params.get('status') as TaskStatus | null) ?? ''}
            onChange={(event) => setParam('status', event.target.value)}
            className="h-10 rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm"
          >
            {statusOptions.map((item) => <option key={item.label} value={item.value}>{item.label}</option>)}
          </select>
          <select
            value={(params.get('priority') as TaskPriority | null) ?? ''}
            onChange={(event) => setParam('priority', event.target.value)}
            className="h-10 rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm"
          >
            {priorityOptions.map((item) => <option key={item.label} value={item.value}>{item.label}</option>)}
          </select>
          <select
            value={params.get('sort') ?? 'due'}
            onChange={(event) => setParam('sort', event.target.value)}
            className="h-10 rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm"
          >
            <option value="due">Сортировка: срок</option>
            <option value="priority">Сортировка: приоритет</option>
            <option value="created">Сортировка: создано</option>
          </select>
          <button
            type="button"
            onClick={() => router.push('/tasks')}
            className="btn-base btn-secondary h-10"
          >
            Сбросить
          </button>
        </div>
      </UiCard>

      {selected.length ? (
        <div className="sticky top-20 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] p-3 text-sm shadow-sm">
          <span className="font-semibold text-[var(--accent)]">Выбрано: {selected.length}</span>
          <button type="button" onClick={bulkComplete} disabled={complete.isPending} className="btn-base btn-success h-9 px-3">
            <CheckCircle2 size={16} />
            Завершить
          </button>
          <button type="button" onClick={bulkDelete} disabled={remove.isPending} className="btn-base btn-danger h-9 px-3">
            <Trash2 size={16} />
            В корзину
          </button>
          <button type="button" onClick={() => setSelected([])} className="btn-base btn-ghost h-9 px-3">
            Отменить выбор
          </button>
        </div>
      ) : null}

      {tasks.isLoading ? <LoadingState text="Загружаю задачи…" /> : null}
      {tasks.error ? <ErrorState text={`Не удалось загрузить задачи: ${tasks.error.message}`} /> : null}
      {!tasks.isLoading && !tasks.error && !tasks.data?.length ? (
        <EmptyPanel title="Задач пока нет" text="Создай первую задачу или измени фильтры." />
      ) : null}

      {tasks.data?.length ? (
        <UiCard className="overflow-hidden">
          <div className="hidden overflow-x-auto md:block">
            <table className="focus-table w-full text-sm">
              <thead>
                <tr>
                  <th className="w-12 p-4">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? [] : tasks.data.map((task) => task.id))}
                      aria-label="Выбрать все задачи"
                    />
                  </th>
                  <th className="p-4">Задача</th>
                  <th className="p-4">Проект</th>
                  <th className="p-4">Срок</th>
                  <th className="p-4">Приоритет</th>
                  <th className="p-4">Статус</th>
                  <th className="p-4">Длит.</th>
                  <th className="w-12 p-4" />
                </tr>
              </thead>
              <tbody>
                {tasks.data.map((task) => (
                  <TaskTableRow
                    key={task.id}
                    task={task}
                    selected={selected.includes(task.id)}
                    compact={density === 'compact'}
                    onSelect={() => toggleSelection(task.id)}
                    onComplete={() => complete.mutate(task.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-2 p-3 md:hidden">
            {tasks.data.map((task) => (
              <TaskMobileRow
                key={task.id}
                task={task}
                selected={selected.includes(task.id)}
                onSelect={() => toggleSelection(task.id)}
                onComplete={() => complete.mutate(task.id)}
              />
            ))}
          </div>
        </UiCard>
      ) : null}

      <CreateEntityModal
        open={Boolean(createModal) || urlCreateOpen}
        state={createModal ?? { entity: 'task', kind: urlCreateKind }}
        onClose={() => {
          setCreateModal(null);
          if (urlCreateOpen) router.replace('/tasks');
        }}
      />
    </Page>
  );
}

function TaskTableRow({
  task,
  selected,
  compact,
  onSelect,
  onComplete,
}: {
  task: Task;
  selected: boolean;
  compact: boolean;
  onSelect: () => void;
  onComplete: () => void;
}) {
  return (
    <tr className="task-row transition">
      <td className={`${compact ? 'p-3' : 'p-4'}`}>
        <input type="checkbox" checked={selected} onChange={onSelect} aria-label={`Выбрать ${task.title}`} />
      </td>
      <td className={`${compact ? 'p-3' : 'p-4'} min-w-[280px]`}>
        <TaskModalLink task={task} className="text-left font-semibold hover:text-[var(--accent)]">
          {task.title}
        </TaskModalLink>
        {task.description ? <p className="mt-1 line-clamp-1 text-xs text-[var(--muted)]">{task.description}</p> : null}
      </td>
      <td className={`${compact ? 'p-3' : 'p-4'} text-[var(--muted)]`}>{task.project?.name ?? 'Без проекта'}</td>
      <td className={`${compact ? 'p-3' : 'p-4'} whitespace-nowrap text-[var(--muted)]`}>
        <span className="inline-flex items-center gap-1.5">
          <Clock3 size={14} />
          {formatDate(task.dueAt)}
        </span>
      </td>
      <td className={`${compact ? 'p-3' : 'p-4'}`}><PriorityBadge priority={task.priority} /></td>
      <td className={`${compact ? 'p-3' : 'p-4'}`}><StatusBadge status={task.status} /></td>
      <td className={`${compact ? 'p-3' : 'p-4'} whitespace-nowrap text-[var(--muted)]`}>{formatMinutes(task.estimatedDurationMinutes)}</td>
      <td className={`${compact ? 'p-3' : 'p-4'}`}>
        <button type="button" onClick={onComplete} className="rounded-xl p-2 text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]" title="Выполнить">
          {task.status === 'COMPLETED' ? <MoreHorizontal size={17} /> : <CheckCircle2 size={17} />}
        </button>
      </td>
    </tr>
  );
}

function TaskMobileRow({
  task,
  selected,
  onSelect,
  onComplete,
}: {
  task: Task;
  selected: boolean;
  onSelect: () => void;
  onComplete: () => void;
}) {
  return (
    <article className="rounded-2xl border border-[var(--focus-border-soft,var(--line))] bg-[var(--focus-surface-secondary,var(--background))] p-3">
      <div className="flex items-start gap-3">
        <input className="mt-1" type="checkbox" checked={selected} onChange={onSelect} aria-label={`Выбрать ${task.title}`} />
        <div className="min-w-0 flex-1">
          <TaskModalLink task={task} className="text-left font-semibold hover:text-[var(--accent)]">
            {task.title}
          </TaskModalLink>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {task.project?.name ?? 'Без проекта'} · {formatDate(task.dueAt)} · {formatMinutes(task.estimatedDurationMinutes)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
          </div>
        </div>
        {task.status !== 'COMPLETED' ? (
          <button type="button" onClick={onComplete} className="rounded-xl p-2 text-[var(--accent)] hover:bg-[var(--accent-soft)]" title="Выполнить">
            <CheckCircle2 size={18} />
          </button>
        ) : null}
      </div>
    </article>
  );
}
