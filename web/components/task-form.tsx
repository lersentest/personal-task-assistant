'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { invalidateTaskCaches } from '@/lib/cache';
import { taskKindLabel } from '@/lib/labels';
import { Task, TaskInput, TaskKind } from '@/lib/types';

const taskKinds: TaskKind[] = ['TASK', 'CALL', 'MEETING', 'IDEA', 'NOTE'];

export function TaskForm({
  task,
  projectId,
  onDone,
  compact = false,
  initialKind = 'TASK',
}: {
  task?: Task;
  projectId?: string;
  onDone?: () => void;
  compact?: boolean;
  initialKind?: TaskKind;
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
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState(
    task?.estimatedDurationMinutes?.toString() ?? '',
  );

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
      className={`grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] ${compact ? 'p-3 shadow-none' : 'p-4 shadow-sm'}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim()) mutation.mutate();
      }}
    >
      <input
        className="h-11 rounded-xl border border-[var(--line)] bg-transparent px-3 outline-none focus:border-[var(--accent)]"
        placeholder="Название задачи"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        required
      />

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

      {!compact ? (
        <textarea
          className="min-h-24 rounded-xl border border-[var(--line)] bg-transparent p-3 outline-none focus:border-[var(--accent)]"
          placeholder="Описание"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <select
          className="h-11 rounded-xl border border-[var(--line)] bg-transparent px-3"
          value={selectedProjectId}
          onChange={(event) => setSelectedProjectId(event.target.value)}
        >
          <option value="">Без проекта</option>
          {projects.data?.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
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
      <div className="flex flex-wrap gap-2">
        <button
          className="btn-base btn-primary h-10"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Сохраняю...' : task ? 'Сохранить' : 'Создать'}
        </button>
        {onDone ? (
          <button
            type="button"
            onClick={onDone}
            className="btn-base btn-secondary h-10"
          >
            Отмена
          </button>
        ) : null}
      </div>
    </form>
  );
}
