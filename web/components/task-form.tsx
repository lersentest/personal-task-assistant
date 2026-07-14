'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Task } from '@/lib/types';

export function TaskForm({
  task,
  projectId,
  onDone,
}: {
  task?: Task;
  projectId?: string;
  onDone?: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [selectedProjectId, setSelectedProjectId] = useState(task?.project?.id ?? projectId ?? '');
  const [priority, setPriority] = useState(task?.priority ?? 'NORMAL');
  const [status, setStatus] = useState(task?.status ?? 'NEW');
  const [dueAt, setDueAt] = useState(task?.dueAt ? task.dueAt.slice(0, 16) : '');

  const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects });
  const mutation = useMutation({
    mutationFn: () => {
      const input = {
        title,
        description: description || null,
        projectId: selectedProjectId || null,
        priority,
        status,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      };
      return task ? api.updateTask(task.id, input) : api.createTask(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      onDone?.();
    },
  });

  return (
    <form
      className="grid gap-4 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim()) mutation.mutate();
      }}
    >
      <input className="h-11 rounded-lg border border-[var(--line)] bg-transparent px-3 outline-none focus:border-[var(--accent)]" placeholder="Название задачи" value={title} onChange={(event) => setTitle(event.target.value)} required />
      <textarea className="min-h-24 rounded-lg border border-[var(--line)] bg-transparent p-3 outline-none focus:border-[var(--accent)]" placeholder="Описание" value={description} onChange={(event) => setDescription(event.target.value)} />
      <div className="grid gap-3 sm:grid-cols-4">
        <select className="h-11 rounded-lg border border-[var(--line)] bg-transparent px-3" value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
          <option value="">Без проекта</option>
          {projects.data?.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <select className="h-11 rounded-lg border border-[var(--line)] bg-transparent px-3" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
          <option value="NEW">Новая</option>
          <option value="IN_PROGRESS">В работе</option>
          <option value="COMPLETED">Выполнена</option>
          <option value="CANCELLED">Отменена</option>
        </select>
        <select className="h-11 rounded-lg border border-[var(--line)] bg-transparent px-3" value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}>
          <option value="LOW">Низкий</option>
          <option value="NORMAL">Обычный</option>
          <option value="HIGH">Высокий</option>
          <option value="URGENT">Срочный</option>
        </select>
        <input className="h-11 rounded-lg border border-[var(--line)] bg-transparent px-3" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
      </div>
      {mutation.error ? <p className="text-sm text-red-500">{mutation.error.message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button className="h-10 rounded-lg bg-[var(--foreground)] px-4 text-sm font-medium text-[var(--background)]" disabled={mutation.isPending}>
          {task ? 'Сохранить' : 'Создать'}
        </button>
        {onDone ? <button type="button" onClick={onDone} className="h-10 rounded-lg border border-[var(--line)] px-4 text-sm">Отмена</button> : null}
      </div>
    </form>
  );
}

