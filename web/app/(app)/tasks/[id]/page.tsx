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
        <div className="grid gap-5 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
          <div className="grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-2 lg:grid-cols-4">
            <Info label="Статус" value={statusLabel[task.data.status]} />
            <Info label="Приоритет" value={priorityLabel[task.data.priority]} />
            <Info label="Срок" value={formatDate(task.data.dueAt)} />
            <Info label="Создана" value={formatDate(task.data.createdAt)} />
          </div>
          <p className="whitespace-pre-wrap text-[var(--foreground)]">{task.data.description ?? 'Описание не указано.'}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setEditing(true)} className="rounded-xl bg-[var(--foreground)] px-4 py-2 text-sm text-[var(--background)]">Редактировать</button>
            <button onClick={() => remove.mutate()} className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm">Переместить в корзину</button>
          </div>
        </div>
      ) : null}
      <div className="mt-6">
        <AttachmentPanel taskId={id} />
      </div>
    </Page>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--background)] p-3">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}
