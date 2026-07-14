'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { AttachmentPanel } from '@/components/attachment-panel';
import { Page } from '@/components/page';
import { TaskForm } from '@/components/task-form';
import { api } from '@/lib/api';
import { formatDate, priorityLabel, statusLabel } from '@/lib/labels';

export default function TaskDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const task = useQuery({ queryKey: ['task', id], queryFn: () => api.task(id) });
  const remove = useMutation({
    mutationFn: () => api.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries();
      router.push('/trash');
    },
  });

  return (
    <Page title={task.data?.title ?? 'Задача'} description={task.data?.project?.name ?? 'Без проекта'}>
      {task.data && editing ? <TaskForm task={task.data} onDone={() => setEditing(false)} /> : null}
      {task.data && !editing ? (
        <div className="grid gap-4 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
          <div className="grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2 lg:grid-cols-4">
            <p>Статус: {statusLabel[task.data.status]}</p>
            <p>Приоритет: {priorityLabel[task.data.priority]}</p>
            <p>Срок: {formatDate(task.data.dueAt)}</p>
            <p>Создана: {formatDate(task.data.createdAt)}</p>
          </div>
          <p className="whitespace-pre-wrap">{task.data.description ?? 'Описание не указано.'}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setEditing(true)} className="rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm text-[var(--background)]">Редактировать</button>
            <button onClick={() => remove.mutate()} className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm">Переместить в корзину</button>
          </div>
        </div>
      ) : null}
      <div className="mt-6">
        <AttachmentPanel taskId={id} />
      </div>
    </Page>
  );
}
