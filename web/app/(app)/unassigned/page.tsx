'use client';

import { useQuery } from '@tanstack/react-query';
import { Page } from '@/components/page';
import { TaskCard } from '@/components/task-card';
import { api } from '@/lib/api';

export default function UnassignedPage() {
  const tasks = useQuery({ queryKey: ['tasks', 'unassigned'], queryFn: () => api.tasks('?unassigned=true') });
  return (
    <Page title="Без проекта" description="Задачи, которые ещё не привязаны к проекту.">
      <div className="grid gap-3 xl:grid-cols-2">
        {tasks.data?.map((task) => <TaskCard key={task.id} task={task} />)}
      </div>
    </Page>
  );
}
