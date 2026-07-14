'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Page } from '@/components/page';
import { TaskCard } from '@/components/task-card';
import { TaskForm } from '@/components/task-form';
import { api } from '@/lib/api';

export default function TasksPage() {
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const query = params.toString() ? `?${params.toString()}` : '';
  const tasks = useQuery({ queryKey: ['tasks', query], queryFn: () => api.tasks(query) });
  const complete = useMutation({ mutationFn: api.completeTask, onSuccess: () => queryClient.invalidateQueries() });
  const showCreate = params.get('create') === '1';

  return (
    <Page title="Задачи" description="Список, фильтры и быстрое управление." actions={<a className="rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm text-[var(--background)]" href="/tasks?create=1">Новая задача</a>}>
      {showCreate ? <div className="mb-6"><TaskForm /></div> : null}
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {[
          ['Все', '/tasks'],
          ['В работе', '/tasks?status=IN_PROGRESS'],
          ['Срочные', '/tasks?priority=URGENT'],
          ['Выполненные', '/tasks?view=COMPLETED'],
          ['Без проекта', '/tasks?unassigned=true'],
        ].map(([label, href]) => <a key={href} href={href} className="rounded-lg border border-[var(--line)] px-3 py-2 hover:bg-[var(--panel)]">{label}</a>)}
      </div>
      <div className="grid gap-3">
        {tasks.data?.map((task) => <TaskCard key={task.id} task={task} onComplete={(id) => complete.mutate(id)} />)}
      </div>
    </Page>
  );
}

