'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Page } from '@/components/page';
import { TaskCard } from '@/components/task-card';
import { api } from '@/lib/api';

export default function TrashPage() {
  const queryClient = useQueryClient();
  const tasks = useQuery({ queryKey: ['trash'], queryFn: () => api.tasks('?view=TRASH') });
  const restore = useMutation({ mutationFn: api.restoreTask, onSuccess: () => queryClient.invalidateQueries() });

  return (
    <Page title="Корзина" description="Удалённые задачи. Окончательное удаление пока не включено.">
      <div className="grid gap-3">
        {tasks.data?.map((task) => <TaskCard key={task.id} task={task} onRestore={(id) => restore.mutate(id)} />)}
      </div>
    </Page>
  );
}

