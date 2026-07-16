'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { TaskPriority } from '@/lib/types';

const emptyForm = {
  title: '',
  description: '',
  executorId: '',
  projectId: '',
  priority: 'NORMAL' as TaskPriority,
  dueAt: '',
};

export function DelegatedTaskForm({ onDone }: { onDone?: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const executors = useQuery({ queryKey: ['executors'], queryFn: api.executors });
  const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects });

  const create = useMutation({
    mutationFn: api.createDelegatedTask,
    onSuccess: async () => {
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ['delegated-tasks'] });
      onDone?.();
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!form.title.trim() || !form.executorId || create.isPending) return;
        create.mutate({
          title: form.title.trim(),
          description: form.description.trim() || null,
          executorId: form.executorId,
          projectId: form.projectId || null,
          priority: form.priority,
          dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
        });
      }}
      className="grid gap-4 rounded-3xl border border-[var(--focus-border,var(--line))] bg-[var(--focus-surface,var(--panel))] p-5 shadow-sm sm:grid-cols-2 sm:p-6"
    >
      <div className="sm:col-span-2">
        <h2 className="text-lg font-semibold">Новая делегированная задача</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Выбери исполнителя и опиши результат, который нужно получить.
        </p>
      </div>
      <input
        className="h-12 w-full rounded-2xl border border-[var(--focus-border,var(--line))] bg-[var(--focus-surface-secondary,var(--background))] px-4 py-2 outline-none transition focus:border-[var(--accent)] sm:col-span-2"
        placeholder="Название *"
        value={form.title}
        onChange={(event) => setForm({ ...form, title: event.target.value })}
        required
      />
      <textarea
        className="min-h-28 w-full rounded-2xl border border-[var(--focus-border,var(--line))] bg-[var(--focus-surface-secondary,var(--background))] px-4 py-3 outline-none transition focus:border-[var(--accent)] sm:col-span-2"
        placeholder="Описание"
        value={form.description}
        onChange={(event) => setForm({ ...form, description: event.target.value })}
      />
      <select
        className="h-12 w-full rounded-2xl border border-[var(--focus-border,var(--line))] bg-[var(--focus-surface-secondary,var(--background))] px-4 py-2"
        value={form.executorId}
        onChange={(event) => setForm({ ...form, executorId: event.target.value })}
        required
      >
        <option value="">Выберите исполнителя</option>
        {executors.data?.map((executor) => (
          <option key={executor.id} value={executor.id}>
            {executor.fullName}
          </option>
        ))}
      </select>
      <select
        className="h-12 w-full rounded-2xl border border-[var(--focus-border,var(--line))] bg-[var(--focus-surface-secondary,var(--background))] px-4 py-2"
        value={form.projectId}
        onChange={(event) => setForm({ ...form, projectId: event.target.value })}
      >
        <option value="">Без проекта</option>
        {projects.data?.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      <select
        className="h-12 w-full rounded-2xl border border-[var(--focus-border,var(--line))] bg-[var(--focus-surface-secondary,var(--background))] px-4 py-2"
        value={form.priority}
        onChange={(event) => setForm({ ...form, priority: event.target.value as TaskPriority })}
      >
        <option value="LOW">Низкий</option>
        <option value="NORMAL">Обычный</option>
        <option value="HIGH">Высокий</option>
        <option value="URGENT">Срочный</option>
      </select>
      <input
        type="datetime-local"
        className="h-12 w-full rounded-2xl border border-[var(--focus-border,var(--line))] bg-[var(--focus-surface-secondary,var(--background))] px-4 py-2"
        value={form.dueAt}
        onChange={(event) => setForm({ ...form, dueAt: event.target.value })}
      />
      <button
        disabled={create.isPending || !form.executorId || !form.title.trim()}
        className="btn-base btn-primary h-12 w-full sm:col-span-2"
      >
        {create.isPending ? 'Создаю...' : 'Создать задачу'}
      </button>
      {create.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
          {create.error.message}
        </p>
      ) : null}
    </form>
  );
}
