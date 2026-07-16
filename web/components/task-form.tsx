'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { invalidateTaskCaches } from '@/lib/cache';
import { taskKindLabel } from '@/lib/labels';
import { Task, TaskInput, TaskKind } from '@/lib/types';
import { ProjectCombobox } from './project-combobox';

const taskKinds: TaskKind[] = ['TASK', 'CALL', 'MEETING', 'IDEA', 'NOTE'];

export function TaskForm({
  task,
  projectId,
  onDone,
  compact = false,
  initialKind = 'TASK',
  showKindSelector = true,
}: {
  task?: Task;
  projectId?: string;
  onDone?: () => void;
  compact?: boolean;
  initialKind?: TaskKind;
  showKindSelector?: boolean;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [selectedProjectId, setSelectedProjectId] = useState(task?.project?.id ?? projectId ?? '');
  const [priority, setPriority] = useState(task?.priority ?? 'NORMAL');
  const [status, setStatus] = useState(task?.status ?? 'NEW');
  const [kind, setKind] = useState<TaskKind>(task?.kind ?? initialKind);
  const [isFlexible, setIsFlexible] = useState(task?.isFlexible ?? true);
  const [dueAt, setDueAt] = useState(task?.dueAt ? task.dueAt.slice(0, 16) : '');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState(
    task?.estimatedDurationMinutes?.toString() ?? '',
  );
  const titleError = submitAttempted && !title.trim();

  const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects });
  const mutation = useMutation({
    mutationFn: () => {
      const input: TaskInput = {
        title,
        description: description || null,
        projectId: selectedProjectId || null,
        priority,
        status,
        kind,
        isFlexible,
        dueDateType: dueAt ? (isFlexible ? 'ON_DATE' : 'EXACT_TIME') : null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        estimatedDurationMinutes: estimatedDurationMinutes
          ? Number(estimatedDurationMinutes)
          : null,
      };
      return task ? api.updateTask(task.id, input) : api.createTask(input);
    },
    onSuccess: async (savedTask) => {
      await invalidateTaskCaches(queryClient, savedTask.id);
      if (!task) {
        setTitle('');
        setDescription('');
        setEstimatedDurationMinutes('');
      }
      onDone?.();
    },
  });

  return (
    <form
      noValidate
      className={`grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] ${compact ? 'p-3 shadow-none' : 'p-4 shadow-sm'}`}
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitAttempted(true);
        if (title.trim()) mutation.mutate();
      }}
    >
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-[var(--muted)]">Название *</span>
        <input
          className={`h-11 rounded-xl border bg-transparent px-3 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] ${titleError ? 'border-red-300' : 'border-[var(--line)]'}`}
          placeholder="Название задачи"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (submitAttempted) setSubmitAttempted(false);
          }}
          aria-invalid={titleError}
        />
        {titleError ? <span className="text-xs text-red-600">Укажи название задачи.</span> : null}
      </label>

      {showKindSelector ? (
        <div className="flex flex-wrap gap-2">
          {taskKinds.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                kind === value
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)]'
              }`}
            >
              {taskKindLabel[value]}
            </button>
          ))}
        </div>
      ) : null}

      {!compact ? (
        <textarea
          className="min-h-24 rounded-xl border border-[var(--line)] bg-transparent p-3 outline-none focus:border-[var(--accent)]"
          placeholder="Описание"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <ProjectCombobox
          className="h-11"
          projects={projects.data}
          value={selectedProjectId}
          onChange={setSelectedProjectId}
        />
        <select
          className="h-11 rounded-xl border border-[var(--line)] bg-transparent px-3"
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
        >
          <option value="NEW">Новая</option>
          <option value="IN_PROGRESS">В работе</option>
          <option value="COMPLETED">Выполнена</option>
          <option value="CANCELLED">Отменена</option>
        </select>
        <select
          className="h-11 rounded-xl border border-[var(--line)] bg-transparent px-3"
          value={priority}
          onChange={(event) => setPriority(event.target.value as typeof priority)}
        >
          <option value="LOW">Низкий</option>
          <option value="NORMAL">Обычный</option>
          <option value="HIGH">Высокий</option>
          <option value="URGENT">Срочный</option>
        </select>
        <input
          className="h-11 rounded-xl border border-[var(--line)] bg-transparent px-3"
          type="datetime-local"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
        />
        <select
          className="h-11 rounded-xl border border-[var(--line)] bg-transparent px-3"
          value={isFlexible ? 'flexible' : 'fixed'}
          onChange={(event) => setIsFlexible(event.target.value === 'flexible')}
        >
          <option value="flexible">Гибкая</option>
          <option value="fixed">Фиксированная</option>
        </select>
        <input
          className="h-11 rounded-xl border border-[var(--line)] bg-transparent px-3"
          type="number"
          min={5}
          max={1440}
          step={5}
          placeholder="Минуты"
          value={estimatedDurationMinutes}
          onChange={(event) => setEstimatedDurationMinutes(event.target.value)}
        />
      </div>

      {mutation.error ? <p className="text-sm text-red-500">{mutation.error.message}</p> : null}
      <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--line)] pt-4">
        {onDone ? (
          <button
            type="button"
            onClick={onDone}
            className="btn-base btn-secondary h-10"
          >
            Отмена
          </button>
        ) : null}
        <button
          className="btn-base btn-primary h-10 px-5"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Сохраняю...' : task ? 'Сохранить' : 'Создать'}
        </button>
      </div>
    </form>
  );
}
