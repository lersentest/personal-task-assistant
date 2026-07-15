'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Page } from '@/components/page';
import { TaskCard } from '@/components/task-card';
import { api } from '@/lib/api';
import { Task } from '@/lib/types';

export default function TodayPage() {
  const queryClient = useQueryClient();
  const overdue = useQuery({ queryKey: ['tasks', 'overdue'], queryFn: () => api.tasks('?view=OVERDUE') });
  const today = useQuery({ queryKey: ['tasks', 'today'], queryFn: () => api.tasks('?view=TODAY') });
  const upcoming = useQuery({ queryKey: ['tasks', 'upcoming'], queryFn: () => api.tasks('?view=UPCOMING') });
  const complete = useMutation({
    mutationFn: api.completeTask,
    onSuccess: () => queryClient.invalidateQueries(),
  });

  return (
    <Page title="Сегодня" description="Просроченные, сегодняшние и ближайшие задачи.">
      <div className="grid gap-6 xl:grid-cols-3">
        {[
          { title: 'Просроченные', tasks: overdue.data ?? [] },
          { title: 'Сегодня', tasks: today.data ?? [] },
          { title: 'Ближайшие 7 дней', tasks: upcoming.data ?? [] },
        ].map(({ title, tasks }: { title: string; tasks: Task[] }) => (
          <section key={title} className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">{title}</h2>
            <div className="grid gap-3">
              {tasks.map((task) => <TaskCard key={task.id} task={task} onComplete={(id) => complete.mutate(id)} />)}
            </div>
          </section>
        ))}
      </div>
    </Page>
  );
}
