'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, FileText, Lightbulb, Phone, Users, type LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { invalidateTaskCaches } from '@/lib/cache';
import { priorityLabel, taskKindLabel } from '@/lib/labels';
import { Task, TaskInput, TaskKind } from '@/lib/types';
import { ProjectCombobox } from './project-combobox';

type DueMode = 'NONE' | 'ON_DATE' | 'BEFORE_DATE' | 'EXACT_TIME';

const taskKinds: Array<{ value: TaskKind; icon: LucideIcon; hint: string }> = [
  { value: 'TASK', icon: CheckSquare, hint: 'Обычная задача' },
  { value: 'CALL', icon: Phone, hint: 'Звонок' },
  { value: 'MEETING', icon: Users, hint: 'Встреча' },
  { value: 'IDEA', icon: Lightbulb, hint: 'Идея' },
  { value: 'NOTE', icon: FileText, hint: 'Заметка' },
];

const dueModes: Array<{ value: DueMode; label: string; description: string }> = [
  { value: 'NONE', label: 'Без срока', description: 'Задача без дедлайна' },
  { value: 'ON_DATE', label: 'В день', description: 'Нужно сделать в выбранный день' },
  { value: 'BEFORE_DATE', label: 'До', description: 'Дедлайн до даты или времени' },
  { value: 'EXACT_TIME', label: 'Точное время', description: 'Событие в конкретный момент' },
];

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function localDate(offsetDays = 0) {
  const value = new Date();
  value.setDate(value.getDate() + offsetDays);
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function splitLocalDateTime(value: string | null | undefined) {
  if (!value) return { date: '', time: '' };
  const date = new Date(value);
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function initialDueMode(task?: Task): DueMode {
  if (!task?.dueAt) return 'NONE';
  if (task.dueDateType === 'BEFORE_DATE') return 'BEFORE_DATE';
  if (task.dueDateType === 'EXACT_TIME' || task.isFlexible === false) return 'EXACT_TIME';
  return 'ON_DATE';
}

function buildDueAt(mode: DueMode, date: string, time: string) {
  if (mode === 'NONE' || !date) return null;
  if (mode === 'ON_DATE') return new Date(`${date}T23:59:59`).toISOString();
  if (mode === 'BEFORE_DATE') return new Date(`${date}T${time || '23:59'}:00`).toISOString();
  return new Date(`${date}T${time || '09:00'}:00`).toISOString();
}

function dueHint(mode: DueMode) {
  if (mode === 'NONE') return 'Эта задача не попадёт в просроченные, пока ты не задашь срок.';
  if (mode === 'ON_DATE') return 'Просрочится только после конца выбранного дня.';
  if (mode === 'BEFORE_DATE') return 'Просрочится после указанного дедлайна. Если время не указать — в конце дня.';
  return 'Подходит для звонков, встреч и задач, которые должны начаться ровно в это время.';
}

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
  const initialDue = useMemo(() => splitLocalDateTime(task?.dueAt), [task?.dueAt]);
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [selectedProjectId, setSelectedProjectId] = useState(task?.project?.id ?? projectId ?? '');
  const [priority, setPriority] = useState(task?.priority ?? 'NORMAL');
  const [kind, setKind] = useState<TaskKind>(task?.kind ?? initialKind);
  const [dueMode, setDueMode] = useState<DueMode>(initialDueMode(task));
  const [dueDate, setDueDate] = useState(initialDue.date);
  const [dueTime, setDueTime] = useState(initialDue.time);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState(
    task?.estimatedDurationMinutes?.toString() ?? '',
  );
  const titleError = submitAttempted && !title.trim();

  const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects });
  const mutation = useMutation({
    mutationFn: () => {
      const dueAt = buildDueAt(dueMode, dueDate, dueTime);
      const input: TaskInput = {
        title: title.trim(),
        description: description.trim() || null,
        projectId: selectedProjectId || null,
        priority,
        kind,
        isFlexible: dueMode !== 'EXACT_TIME',
        dueDateType: dueMode === 'NONE' ? null : dueMode,
        dueAt,
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
        setDueMode('NONE');
        setDueDate('');
        setDueTime('');
      }
      onDone?.();
    },
  });

  function applyDate(date: string, mode: DueMode = dueMode) {
    setDueMode(mode);
    setDueDate(date);
  }

  function applyTime(time: string, mode: DueMode = dueMode === 'NONE' ? 'EXACT_TIME' : dueMode) {
    setDueMode(mode);
    if (!dueDate) setDueDate(localDate());
    setDueTime(time);
  }

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
      <div className={`grid gap-4 ${showKindSelector ? 'lg:grid-cols-[minmax(0,1fr)_220px]' : 'lg:grid-cols-[220px]'}`}>
        {showKindSelector ? (
          <div className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Тип
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {taskKinds.map((item) => {
                const Icon = item.icon;
                const active = kind === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setKind(item.value)}
                    className={`group grid min-h-20 gap-2 rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'border-[var(--line)] bg-[var(--background)]/45 text-[var(--muted)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]'
                    }`}
                    title={item.hint}
                  >
                    <Icon size={19} />
                    <span className="text-sm font-semibold">{taskKindLabel[item.value]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <label className="grid content-start gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Приоритет
          </span>
          <select
            className="h-12 rounded-xl border border-[var(--line)] bg-transparent px-3 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
            value={priority}
            onChange={(event) => setPriority(event.target.value as typeof priority)}
          >
            <option value="LOW">{priorityLabel.LOW}</option>
            <option value="NORMAL">{priorityLabel.NORMAL}</option>
            <option value="HIGH">{priorityLabel.HIGH}</option>
            <option value="URGENT">{priorityLabel.URGENT}</option>
          </select>
        </label>
      </div>

      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-[var(--muted)]">Название *</span>
        <input
          className={`h-12 rounded-xl border bg-transparent px-3 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] ${titleError ? 'border-red-300' : 'border-[var(--line)]'}`}
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

      {!compact ? (
        <textarea
          className="min-h-24 rounded-xl border border-[var(--line)] bg-transparent p-3 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
          placeholder="Описание"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      ) : null}

      <ProjectCombobox
        className="h-12"
        projects={projects.data}
        value={selectedProjectId}
        onChange={setSelectedProjectId}
      />

      <section className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--background)]/45 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Срок и время</h3>
            <p className="text-sm text-[var(--muted)]">{dueHint(dueMode)}</p>
          </div>
          <input
            className="h-10 w-32 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
            type="number"
            min={5}
            max={1440}
            step={5}
            placeholder="Минуты"
            value={estimatedDurationMinutes}
            onChange={(event) => setEstimatedDurationMinutes(event.target.value)}
            title="Оценка длительности"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          {dueModes.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => setDueMode(mode.value)}
              className={`rounded-xl border p-3 text-left transition active:scale-[0.98] ${
                dueMode === mode.value
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]'
              }`}
            >
              <span className="block text-sm font-semibold">{mode.label}</span>
              <span className="mt-1 block text-xs opacity-80">{mode.description}</span>
            </button>
          ))}
        </div>

        {dueMode !== 'NONE' ? (
          <div className="grid gap-3 lg:grid-cols-[1fr_180px]">
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-[var(--muted)]">Дата</span>
              <input
                className="h-11 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>
            {dueMode !== 'ON_DATE' ? (
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-[var(--muted)]">
                  {dueMode === 'BEFORE_DATE' ? 'Время, если нужно' : 'Время'}
                </span>
                <input
                  className="h-11 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
                  type="time"
                  value={dueTime}
                  onChange={(event) => setDueTime(event.target.value)}
                />
              </label>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 text-sm">
          <button type="button" onClick={() => applyDate(localDate(), 'ON_DATE')} className="btn-base btn-secondary h-9 px-3">
            Сегодня
          </button>
          <button type="button" onClick={() => applyDate(localDate(1), 'ON_DATE')} className="btn-base btn-secondary h-9 px-3">
            Завтра
          </button>
          <button type="button" onClick={() => applyDate(localDate(), 'BEFORE_DATE')} className="btn-base btn-secondary h-9 px-3">
            До конца дня
          </button>
          <button
            type="button"
            onClick={() => {
              const value = new Date(Date.now() + 60 * 60_000);
              applyDate(`${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`, 'BEFORE_DATE');
              setDueTime(`${pad(value.getHours())}:${pad(value.getMinutes())}`);
            }}
            className="btn-base btn-secondary h-9 px-3"
          >
            +1 час
          </button>
          <button type="button" onClick={() => applyTime('09:00', 'EXACT_TIME')} className="btn-base btn-secondary h-9 px-3">
            09:00
          </button>
          <button type="button" onClick={() => applyTime('14:00', 'EXACT_TIME')} className="btn-base btn-secondary h-9 px-3">
            14:00
          </button>
          <button type="button" onClick={() => applyTime('18:00', 'EXACT_TIME')} className="btn-base btn-secondary h-9 px-3">
            18:00
          </button>
        </div>
      </section>

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
