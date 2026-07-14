'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Project } from '@/lib/types';

export function ProjectForm({ project, onDone }: { project?: Project; onDone?: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [status, setStatus] = useState(project?.status ?? 'ACTIVE');

  const mutation = useMutation({
    mutationFn: () => {
      const input = { name, description: description || null, status };
      return project ? api.updateProject(project.id, input) : api.createProject(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onDone?.();
    },
  });

  return (
    <form className="grid gap-4 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4" onSubmit={(event) => {
      event.preventDefault();
      if (name.trim()) mutation.mutate();
    }}>
      <input className="h-11 rounded-lg border border-[var(--line)] bg-transparent px-3 outline-none focus:border-[var(--accent)]" placeholder="Название проекта" value={name} onChange={(event) => setName(event.target.value)} required />
      <textarea className="min-h-24 rounded-lg border border-[var(--line)] bg-transparent p-3 outline-none focus:border-[var(--accent)]" placeholder="Описание" value={description} onChange={(event) => setDescription(event.target.value)} />
      <select className="h-11 rounded-lg border border-[var(--line)] bg-transparent px-3" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
        <option value="ACTIVE">Активный</option>
        <option value="ON_HOLD">На паузе</option>
        <option value="COMPLETED">Завершён</option>
        <option value="ARCHIVED">Архив</option>
      </select>
      {mutation.error ? <p className="text-sm text-red-500">{mutation.error.message}</p> : null}
      <div className="flex gap-2">
        <button className="h-10 rounded-lg bg-[var(--foreground)] px-4 text-sm font-medium text-[var(--background)]" disabled={mutation.isPending}>
          {project ? 'Сохранить' : 'Создать'}
        </button>
        {onDone ? <button type="button" onClick={onDone} className="h-10 rounded-lg border border-[var(--line)] px-4 text-sm">Отмена</button> : null}
      </div>
    </form>
  );
}

