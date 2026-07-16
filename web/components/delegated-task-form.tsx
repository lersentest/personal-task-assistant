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
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const executors = useQuery({ queryKey: ['executors'], queryFn: api.executors });
  const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects });
  const titleMissing = submitAttempted && !form.title.trim();
  const executorMissing = submitAttempted && !form.executorId;
  const canSubmit = Boolean(form.title.trim() && form.executorId);

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
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitAttempted(true);
        if (!canSubmit || create.isPending) return;
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
      <label className="grid gap-1.5 sm:col-span-2">
        <span className="text-xs font-semibold text-[var(--muted)]">Название *</span>
        <input
          className={`h-12 w-full rounded-2xl border bg-[var(--focus-surface-secondary,var(--background))] px-4 py-2 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] ${titleMissing ? 'border-red-300' : 'border-[var(--focus-border,var(--line))]'}`}
          placeholder="Что нужно сделать исполнителю"
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          aria-invalid={titleMissing}
        />
        {titleMissing ? <span className="text-xs text-red-600">Укажи название задачи.</span> : null}
      </label>
      <label className="grid gap-1.5 sm:col-span-2">
        <span className="text-xs font-semibold text-[var(--muted)]">Описание</span>
        <textarea
          className="min-h-28 w-full rounded-2xl border border-[var(--focus-border,var(--line))] bg-[var(--focus-surface-secondary,var(--background))] px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
          placeholder="Опиши ожидаемый результат, детали и критерии готовности"
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-[var(--muted)]">Исполнитель *</span>
        <select
          className={`h-12 w-full rounded-2xl border bg-[var(--focus-surface-secondary,var(--background))] px-4 py-2 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] ${executorMissing ? 'border-red-300' : 'border-[var(--focus-border,var(--line))]'}`}
          value={form.executorId}
          onChange={(event) => setForm({ ...form, executorId: event.target.value })}
          aria-invalid={executorMissing}
        >
          <option value="">Выберите исполнителя</option>
          {executors.data?.map((executor) => (
            <option key={executor.id} value={executor.id}>
              {executor.fullName}
            </option>
          ))}
        </select>
        {executorMissing ? <span className="text-xs text-red-600">Выбери исполнителя.</span> : null}
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-[var(--muted)]">Проект</span>
        <select
          className="h-12 w-full rounded-2xl border border-[var(--focus-border,var(--line))] bg-[var(--focus-surface-secondary,var(--background))] px-4 py-2 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
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
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-[var(--muted)]">Приоритет</span>
        <select
          className="h-12 w-full rounded-2xl border border-[var(--focus-border,var(--line))] bg-[var(--focus-surface-secondary,var(--background))] px-4 py-2 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
          value={form.priority}
          onChange={(event) => setForm({ ...form, priority: event.target.value as TaskPriority })}
        >
          <option value="LOW">Низкий</option>
          <option value="NORMAL">Обычный</option>
          <option value="HIGH">Высокий</option>
          <option value="URGENT">Срочный</option>
        </select>
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-[var(--muted)]">Срок</span>
        <input
          type="datetime-local"
          className="h-12 w-full rounded-2xl border border-[var(--focus-border,var(--line))] bg-[var(--focus-surface-secondary,var(--background))] px-4 py-2 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
          value={form.dueAt}
          onChange={(event) => setForm({ ...form, dueAt: event.target.value })}
        />
      </label>
      {!canSubmit ? (
        <p className="text-xs text-[var(--muted)] sm:col-span-2">
          Для создания нужны название и исполнитель.
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--focus-border-soft,var(--line))] pt-4 sm:col-span-2">
        {onDone ? (
          <button type="button" onClick={onDone} className="btn-base btn-secondary h-10">
            Отмена
          </button>
        ) : null}
        <button
          disabled={create.isPending}
          className={`btn-base h-10 px-5 ${canSubmit ? 'btn-primary' : 'btn-secondary opacity-70'}`}
        >
          {create.isPending ? 'Создаю...' : 'Создать задачу'}
        </button>
      </div>
      {create.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
          {create.error.message}
        </p>
      ) : null}
    </form>
  );
}
