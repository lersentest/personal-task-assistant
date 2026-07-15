'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { CreateEntityModal, CreateEntityState } from '@/components/create-entity-modal';
import { Page } from '@/components/page';
import { TaskCard } from '@/components/task-card';
import { useUiMode } from '@/components/ui-mode-provider';
import { api } from '@/lib/api';
import { TaskKind } from '@/lib/types';

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
  const router = useRouter();
  const queryClient = useQueryClient();
  const [createModal, setCreateModal] = useState<CreateEntityState | null>(null);
  const query = useMemo(() => {
    const value = new URLSearchParams(params.toString());
    value.delete('create');
    value.delete('type');
    return value.toString() ? `?${value.toString()}` : '';
  }, [params]);
  const tasks = useQuery({ queryKey: ['tasks', query], queryFn: () => api.tasks(query) });
  const complete = useMutation({ mutationFn: api.completeTask, onSuccess: () => queryClient.invalidateQueries() });
  const urlCreateKind = (params.get('type') as TaskKind | null) ?? 'TASK';
  const urlCreateOpen = params.get('create') === '1';

  return (
    <Page
      title="Задачи"
      description="Список, фильтры и быстрые действия."
      actions={
        <button
          type="button"
          onClick={() => setCreateModal({ entity: 'task', kind: 'TASK' })}
          className="rounded-xl bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)]"
        >
          Новая задача
        </button>
      }
    >
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
