'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Page } from '@/components/page';
import { TaskCard } from '@/components/task-card';
import { TaskForm } from '@/components/task-form';
import { useUiMode } from '@/components/ui-mode-provider';
import { api } from '@/lib/api';

const filters = [
  ['Все', '/tasks'],
  ['В работе', '/tasks?status=IN_PROGRESS'],
  ['Срочные', '/tasks?priority=URGENT'],
  ['Выполненные', '/tasks?view=COMPLETED'],
  ['Без проекта', '/tasks?unassigned=true'],
] as const;

export default function TasksPage() {
  const { interfaceMode } = useUiMode();
  const isFocus = interfaceMode === 'focus';
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const query = params.toString() ? `?${params.toString()}` : '';
  const tasks = useQuery({ queryKey: ['tasks', query], queryFn: () => api.tasks(query) });
  const complete = useMutation({ mutationFn: api.completeTask, onSuccess: () => queryClient.invalidateQueries() });
  const showCreate = params.get('create') === '1';

  return (
    <Page
      title="Задачи"
      description="Список, фильтры и быстрые действия."
      actions={<a className="rounded-xl bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)]" href="/tasks?create=1">Новая задача</a>}
    >
      {showCreate ? <div className="mb-6"><TaskForm /></div> : null}
      <div className={isFocus ? 'mb-5 flex flex-wrap gap-2 rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface)] p-2 shadow-sm' : 'mb-4 flex flex-wrap gap-2 text-sm'}>
        {filters.map(([label, href]) => (
          <a
            key={href}
            href={href}
            className={isFocus ? 'rounded-xl px-3 py-2 text-sm font-medium text-[var(--focus-text-secondary)] hover:bg-[var(--focus-primary-soft)] hover:text-[var(--focus-primary)]' : 'rounded-lg border border-[var(--line)] px-3 py-2 hover:bg-[var(--panel)]'}
          >
            {label}
          </a>
        ))}
      </div>
      <div className={isFocus ? 'grid gap-3 xl:grid-cols-2' : 'grid gap-3'}>
        {tasks.data?.map((task) => <TaskCard key={task.id} task={task} onComplete={(id) => complete.mutate(id)} />)}
      </div>
    </Page>
  );
}
