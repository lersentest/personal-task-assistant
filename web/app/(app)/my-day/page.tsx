'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Search,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useUiMode } from '@/components/ui-mode-provider';
import { api } from '@/lib/api';
import { formatDate, priorityLabel, statusLabel, taskKindLabel } from '@/lib/labels';
import { DailyPlanItem, MyDayData, Task, TaskPriority } from '@/lib/types';

const durationOptions = [15, 30, 45, 60, 90, 120, 180, 240];

function todayLocalDate() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} мин`;
  if (!rest) return `${hours} ч`;
  return `${hours} ч ${rest} мин`;
}

function formatTime(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function hourSlot(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}:00`;
}

function dateTimeFor(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function addMinutes(dateIso: string, minutes: number) {
  return new Date(new Date(dateIso).getTime() + minutes * 60_000).toISOString();
}

function taskMeta(task: Task) {
  return [
    taskKindLabel[task.kind ?? 'TASK'],
    task.isFlexible ? 'Гибкая' : 'Фиксированная',
    priorityLabel[task.priority],
    statusLabel[task.status],
    task.estimatedDurationMinutes ? formatMinutes(task.estimatedDurationMinutes) : 'без оценки',
    task.project?.name ?? 'без проекта',
  ];
}

function TaskPill({
  task,
  action,
  actionLabel = 'Добавить',
}: {
  task: Task;
  action?: () => void;
  actionLabel?: string;
}) {
  const { interfaceMode } = useUiMode();
  const isFocus = interfaceMode === 'focus';
  return (
    <article
      draggable
      onDragStart={(event) => event.dataTransfer.setData('text/plain', `task:${task.id}`)}
      className={isFocus ? 'rounded-xl border border-[var(--focus-border-soft)] bg-[var(--focus-surface)] px-3 py-2.5 transition hover:border-[var(--focus-primary)] hover:bg-[var(--focus-primary-soft)]' : 'rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 shadow-sm'}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/tasks/${task.id}`} className={isFocus ? 'text-sm font-semibold hover:text-[var(--focus-primary)]' : 'font-medium hover:text-[var(--accent)]'}>
            {task.title}
          </Link>
          <div className={isFocus ? 'mt-2 flex flex-wrap gap-1.5 text-[11px] text-[var(--focus-text-muted)]' : 'mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]'}>
            <span>{formatDate(task.dueAt)}</span>
            {taskMeta(task).map((item) => (
              <span key={item} className={isFocus ? 'rounded-full bg-[var(--focus-surface-secondary)] px-2 py-0.5' : ''}>{item}</span>
            ))}
          </div>
        </div>
        {action ? (
          <button
            onClick={action}
            className={isFocus ? 'shrink-0 rounded-lg border border-[var(--focus-border)] bg-[var(--focus-surface)] px-2.5 py-1.5 text-xs font-medium hover:border-[var(--focus-primary)]' : 'rounded-md border border-[var(--line)] px-2 py-1 text-xs hover:bg-[var(--background)]'}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function PlanItemCard({
  item,
  date,
  onComplete,
  onRemove,
  onUnschedule,
  onSchedule,
  onDuration,
  compact = false,
}: {
  item: DailyPlanItem;
  date: string;
  onComplete: () => void;
  onRemove: () => void;
  onUnschedule: () => void;
  onSchedule: (start: string, duration: number) => void;
  onDuration: (duration: number) => void;
  compact?: boolean;
}) {
  const { interfaceMode } = useUiMode();
  const isFocus = interfaceMode === 'focus';
  const [time, setTime] = useState(formatTime(item.scheduledStartAt) || '09:00');
  const duration = item.task.estimatedDurationMinutes ?? 30;
  const done = item.completedInPlanAt || item.task.status === 'COMPLETED';

  return (
    <article
      draggable
      onDragStart={(event) => event.dataTransfer.setData('text/plain', `item:${item.id}`)}
      className={`min-w-0 overflow-hidden border ${
        isFocus
          ? `rounded-xl px-3 py-2.5 shadow-none ${
              done
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/25 dark:text-emerald-100'
                : item.scheduledStartAt
                  ? 'border-blue-200 bg-blue-50 dark:bg-blue-950/25'
                  : 'border-[var(--focus-border-soft)] bg-[var(--focus-surface)]'
            }`
          : `rounded-lg p-3 shadow-sm ${
              done
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/25 dark:text-emerald-100'
                : item.scheduledStartAt
                  ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/25'
                  : 'border-[var(--line)] bg-[var(--panel)]'
            }`
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/tasks/${item.task.id}`} className={isFocus ? 'text-sm font-semibold hover:text-[var(--focus-primary)]' : 'font-medium hover:text-[var(--accent)]'}>
            {item.task.title}
          </Link>
          <div className={isFocus ? 'mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-[var(--focus-text-muted)]' : 'mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]'}>
            {item.scheduledStartAt ? (
              <span className="inline-flex items-center gap-1">
                <Clock size={13} />
                {formatTime(item.scheduledStartAt)}–{formatTime(item.scheduledEndAt)}
              </span>
            ) : (
              <span>гибкая задача</span>
            )}
            <span>{priorityLabel[item.task.priority]}</span>
            <span>{taskKindLabel[item.task.kind ?? 'TASK']}</span>
            <span>{formatMinutes(duration)}</span>
            {item.task.project ? <span>{item.task.project.name}</span> : null}
          </div>
        </div>
        <div className="flex gap-1">
          {!done ? (
            <button onClick={onComplete} className="rounded-md p-2 hover:bg-[var(--background)]" title="Выполнить">
              <CheckCircle2 size={17} />
            </button>
          ) : null}
          <button onClick={onRemove} className="rounded-md p-2 hover:bg-[var(--background)]" title="Убрать из дня">
            <Trash2 size={17} />
          </button>
        </div>
      </div>
      {compact ? (
        <div className="mt-3 grid gap-2">
          <div className="flex flex-wrap gap-2">
            {!done ? (
              <button
                onClick={onComplete}
                className="rounded-md border border-[var(--line)] px-3 py-2 text-sm hover:bg-[var(--background)]"
              >
                Выполнить
              </button>
            ) : null}
            <button
              onClick={onRemove}
              className="rounded-md border border-[var(--line)] px-3 py-2 text-sm hover:bg-[var(--background)]"
            >
              Убрать
            </button>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Чтобы назначить время, перетащи задачу на слот в центральной шкале.
          </p>
        </div>
      ) : (
        <>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
        <input
          type="time"
          className="h-9 rounded-md border border-[var(--line)] bg-transparent px-2 text-sm"
          value={time}
          onChange={(event) => setTime(event.target.value)}
        />
        <select
          className="h-9 rounded-md border border-[var(--line)] bg-transparent px-2 text-sm"
          value={duration}
          onChange={(event) => onDuration(Number(event.target.value))}
        >
          {durationOptions.map((value) => (
            <option key={value} value={value}>
              {formatMinutes(value)}
            </option>
          ))}
        </select>
        <button
          onClick={() => onSchedule(time, duration)}
          className="rounded-md bg-[var(--foreground)] px-3 py-2 text-sm text-[var(--background)]"
        >
          Назначить
        </button>
        <button
          onClick={onUnschedule}
          className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        >
          Без времени
        </button>
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Drag-and-drop: можно перетащить задачу на слот временной шкалы.
      </p>
        </>
      )}
    </article>
  );
}

export default function MyDayPage() {
  const { interfaceMode } = useUiMode();
  const isFocus = interfaceMode === 'focus';
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayLocalDate());
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [mobileTab, setMobileTab] = useState<'plan' | 'schedule' | 'add'>('plan');

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(search), 350);
    return () => window.clearTimeout(handle);
  }, [search]);

  const day = useQuery({
    queryKey: ['my-day', date],
    queryFn: () => api.myDay(date),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
  const suggestionsQuery = useMemo(() => {
    const params = new URLSearchParams({ date, limit: '40' });
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    if (priority) params.set('priority', priority);
    return `?${params.toString()}`;
  }, [date, priority, debouncedSearch]);
  const suggestions = useQuery({
    queryKey: ['my-day-suggestions', suggestionsQuery],
    queryFn: () => api.myDaySuggestions(suggestionsQuery),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const dayQueryKey = useMemo(() => ['my-day', date] as const, [date]);
  const suggestionsQueryKey = useMemo(
    () => ['my-day-suggestions', suggestionsQuery] as const,
    [suggestionsQuery],
  );

  function invalidateMyDay(options: { suggestions?: boolean } = {}) {
    queryClient.invalidateQueries({ queryKey: dayQueryKey });
    if (options.suggestions) {
      queryClient.invalidateQueries({ queryKey: suggestionsQueryKey });
    }
  }

  function updateCachedDay(updater: (data: MyDayData) => MyDayData) {
    queryClient.setQueryData<MyDayData>(dayQueryKey, (current) =>
      current ? updater(current) : current,
    );
  }

  function replaceCachedItem(updated: DailyPlanItem) {
    updateCachedDay((current) => {
      const replace = (item: DailyPlanItem) => (item.id === updated.id ? updated : item);
      return {
        ...current,
        planItems: current.planItems.map(replace),
        scheduledItems: updated.scheduledStartAt
          ? [
              ...current.scheduledItems.filter((item) => item.id !== updated.id),
              updated,
            ].sort(
              (a, b) =>
                new Date(a.scheduledStartAt ?? 0).getTime() -
                new Date(b.scheduledStartAt ?? 0).getTime(),
            )
          : current.scheduledItems.filter((item) => item.id !== updated.id),
        completedItems:
          updated.completedInPlanAt || updated.task.status === 'COMPLETED'
            ? [
                ...current.completedItems.filter((item) => item.id !== updated.id),
                updated,
              ]
            : current.completedItems.filter((item) => item.id !== updated.id),
        mandatory: {
          ...current.mandatory,
          plannedToday: current.mandatory.plannedToday.map(replace),
          scheduled: updated.scheduledStartAt
            ? [
                ...current.mandatory.scheduled.filter((item) => item.id !== updated.id),
                updated,
              ]
            : current.mandatory.scheduled.filter((item) => item.id !== updated.id),
        },
      };
    });
  }

  function removeCachedItem(id: string) {
    updateCachedDay((current) => ({
      ...current,
      planItems: current.planItems.filter((item) => item.id !== id),
      scheduledItems: current.scheduledItems.filter((item) => item.id !== id),
      completedItems: current.completedItems.filter((item) => item.id !== id),
      mandatory: {
        ...current.mandatory,
        plannedToday: current.mandatory.plannedToday.filter((item) => item.id !== id),
        scheduled: current.mandatory.scheduled.filter((item) => item.id !== id),
      },
    }));
  }

  const addItem = useMutation({
    mutationFn: api.addMyDayItem,
    onSuccess: (item) => {
      updateCachedDay((current) => ({
        ...current,
        planItems: current.planItems.some((candidate) => candidate.id === item.id)
          ? current.planItems
          : [...current.planItems, item],
        scheduledItems: item.scheduledStartAt
          ? [...current.scheduledItems, item]
          : current.scheduledItems,
        mandatory: {
          ...current.mandatory,
          overdue: current.mandatory.overdue.filter((task) => task.id !== item.taskId),
          dueToday: current.mandatory.dueToday.filter((task) => task.id !== item.taskId),
          plannedToday: item.scheduledStartAt
            ? current.mandatory.plannedToday
            : [...current.mandatory.plannedToday, item],
          scheduled: item.scheduledStartAt
            ? [...current.mandatory.scheduled, item]
            : current.mandatory.scheduled,
        },
      }));
      queryClient.setQueryData<Task[]>(suggestionsQueryKey, (current) =>
        current?.filter((task) => task.id !== item.taskId) ?? current,
      );
      invalidateMyDay({ suggestions: true });
    },
  });
  const updateItem = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof api.updateMyDayItem>[1] }) =>
      api.updateMyDayItem(id, input),
    onSuccess: (item) => {
      replaceCachedItem(item);
      invalidateMyDay();
    },
  });
  const scheduleItem = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof api.scheduleMyDayItem>[1] }) =>
      api.scheduleMyDayItem(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: dayQueryKey });
      const previous = queryClient.getQueryData<MyDayData>(dayQueryKey);
      updateCachedDay((current) => ({
        ...current,
        planItems: current.planItems.map((item) =>
          item.id === id
            ? {
                ...item,
                scheduledStartAt: input.scheduledStartAt,
                scheduledEndAt: input.scheduledEndAt,
                scheduleType: 'FIXED',
                task: {
                  ...item.task,
                  estimatedDurationMinutes:
                    input.estimatedDurationMinutes ?? item.task.estimatedDurationMinutes,
                },
              }
            : item,
        ),
        scheduledItems: [
          ...current.scheduledItems.filter((item) => item.id !== id),
          ...current.planItems
            .filter((item) => item.id === id)
            .map((item) => ({
              ...item,
              scheduledStartAt: input.scheduledStartAt,
              scheduledEndAt: input.scheduledEndAt,
              scheduleType: 'FIXED' as const,
              task: {
                ...item.task,
                estimatedDurationMinutes:
                  input.estimatedDurationMinutes ?? item.task.estimatedDurationMinutes,
              },
            })),
        ].sort(
          (a, b) =>
            new Date(a.scheduledStartAt ?? 0).getTime() -
            new Date(b.scheduledStartAt ?? 0).getTime(),
        ),
      }));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(dayQueryKey, context.previous);
    },
    onSuccess: (item) => {
      replaceCachedItem(item);
      invalidateMyDay();
    },
  });
  const unscheduleItem = useMutation({
    mutationFn: api.unscheduleMyDayItem,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: dayQueryKey });
      const previous = queryClient.getQueryData<MyDayData>(dayQueryKey);
      updateCachedDay((current) => ({
        ...current,
        planItems: current.planItems.map((item) =>
          item.id === id
            ? {
                ...item,
                scheduledStartAt: null,
                scheduledEndAt: null,
                scheduleType: 'FLEXIBLE',
              }
            : item,
        ),
        scheduledItems: current.scheduledItems.filter((item) => item.id !== id),
        mandatory: {
          ...current.mandatory,
          scheduled: current.mandatory.scheduled.filter((item) => item.id !== id),
        },
      }));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(dayQueryKey, context.previous);
    },
    onSuccess: (item) => {
      replaceCachedItem(item);
      invalidateMyDay();
    },
  });
  const removeItem = useMutation({
    mutationFn: api.removeMyDayItem,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: dayQueryKey });
      const previous = queryClient.getQueryData<MyDayData>(dayQueryKey);
      removeCachedItem(id);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(dayQueryKey, context.previous);
    },
    onSuccess: () => invalidateMyDay({ suggestions: true }),
  });
  const completeItem = useMutation({
    mutationFn: api.completeMyDayItem,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: dayQueryKey });
      const previous = queryClient.getQueryData<MyDayData>(dayQueryKey);
      const completedAt = new Date().toISOString();
      updateCachedDay((current) => ({
        ...current,
        planItems: current.planItems.map((item) =>
          item.id === id
            ? {
                ...item,
                completedInPlanAt: completedAt,
                task: {
                  ...item.task,
                  status: 'COMPLETED',
                  completedAt,
                },
              }
            : item,
        ),
        scheduledItems: current.scheduledItems.map((item) =>
          item.id === id
            ? {
                ...item,
                completedInPlanAt: completedAt,
                task: {
                  ...item.task,
                  status: 'COMPLETED',
                  completedAt,
                },
              }
            : item,
        ),
      }));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(dayQueryKey, context.previous);
    },
    onSuccess: (item) => {
      replaceCachedItem(item);
      invalidateMyDay();
    },
  });
  const completeDay = useMutation({
    mutationFn: api.completeMyDay,
    onSuccess: (data) => {
      queryClient.setQueryData(dayQueryKey, data);
      invalidateMyDay({ suggestions: true });
    },
  });

  const planItems = day.data?.planItems ?? [];
  const unscheduledItems = planItems.filter((item) => !item.scheduledStartAt);
  const scheduledItems = day.data?.scheduledItems ?? [];
  const incompleteItems = planItems.filter(
    (item) => item.task.status !== 'COMPLETED' && !item.completedInPlanAt,
  );
  const timelineSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 7; hour < 20; hour += 1) {
      slots.push(`${String(hour).padStart(2, '0')}:00`);
    }
    return slots;
  }, []);

  function addTaskToDay(taskId: string) {
    addItem.mutate({ taskId, date });
  }

  function scheduleExistingItem(item: DailyPlanItem, time: string, duration: number) {
    const start = dateTimeFor(date, time);
    scheduleItem.mutate({
      id: item.id,
      input: {
        scheduledStartAt: start,
        scheduledEndAt: addMinutes(start, duration),
        estimatedDurationMinutes: duration,
      },
    });
  }

  function handleDropOnPlan(event: React.DragEvent) {
    event.preventDefault();
    const value = event.dataTransfer.getData('text/plain');
    if (value.startsWith('task:')) addTaskToDay(value.slice(5));
  }

  function handleDropOnSlot(event: React.DragEvent, time: string) {
    event.preventDefault();
    const value = event.dataTransfer.getData('text/plain');
    const start = dateTimeFor(date, time);
    if (value.startsWith('task:')) {
      addItem.mutate({
        taskId: value.slice(5),
        date,
        scheduledStartAt: start,
        scheduledEndAt: addMinutes(start, 30),
        estimatedDurationMinutes: 30,
      });
    } else if (value.startsWith('item:')) {
      const item = planItems.find((candidate) => candidate.id === value.slice(5));
      const duration = item?.task.estimatedDurationMinutes ?? 30;
      scheduleItem.mutate({
        id: value.slice(5),
        input: {
          scheduledStartAt: start,
          scheduledEndAt: addMinutes(start, duration),
          estimatedDurationMinutes: duration,
        },
      });
    }
  }

  return (
    <div className={isFocus ? 'mx-auto max-w-[1500px] overflow-hidden' : 'mx-auto max-w-[1800px] p-4 sm:p-6'}>
      <header className={isFocus ? 'mb-5 rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface)] p-5 shadow-sm' : 'mb-5 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--muted)]">Ежедневное планирование</p>
            <h1 className="text-2xl font-semibold">Мой день</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setDate(shiftDate(date, -1))}
              className="rounded-lg border border-[var(--line)] p-2"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setDate(todayLocalDate())}
              className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
            >
              Сегодня
            </button>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-10 rounded-lg border border-[var(--line)] bg-transparent px-3 text-sm"
            />
            <button
              onClick={() => setDate(shiftDate(date, 1))}
              className="rounded-lg border border-[var(--line)] p-2"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className={isFocus ? 'mt-4 grid gap-3 md:grid-cols-5' : 'mt-4 grid gap-3 md:grid-cols-5'}>
          <Stat label="Всего задач" value={day.data?.summary.totalTasks ?? 0} />
          <Stat label="Выполнено" value={day.data?.summary.completedTasks ?? 0} />
          <Stat label="Осталось" value={day.data?.summary.remainingTasks ?? 0} />
          <Stat label="Оценка дня" value={formatMinutes(day.data?.summary.estimatedMinutes ?? 0)} />
          <Stat label="Выполнено по времени" value={formatMinutes(day.data?.summary.completedMinutes ?? 0)} />
        </div>
        {day.data?.summary.overloaded || day.data?.summary.conflicts ? (
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {day.data.summary.overloaded ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-amber-800">
                <AlertTriangle size={14} /> Перегрузка: больше 8 часов
              </span>
            ) : null}
            {day.data.summary.conflicts ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-red-800">
                <AlertTriangle size={14} /> Есть пересечения: {day.data.summary.conflicts}
              </span>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="mb-4 grid grid-cols-3 gap-2 lg:hidden">
        {[
          ['plan', 'План'],
          ['schedule', 'Расписание'],
          ['add', 'Добавить'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setMobileTab(key as typeof mobileTab)}
            className={`rounded-lg border px-3 py-2 text-sm ${
              mobileTab === key
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-[var(--line)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={isFocus ? 'grid gap-4 lg:grid-cols-[minmax(250px,330px)_minmax(520px,1fr)_minmax(250px,330px)]' : 'grid gap-4 lg:grid-cols-[minmax(260px,360px)_minmax(420px,1fr)_minmax(280px,380px)]'}>
        <section className={`${mobileTab === 'plan' ? 'block' : 'hidden'} lg:block`}>
          <Panel title="Обязательно сегодня">
            {day.data?.unresolvedPreviousDays.length ? (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Остались незавершённые задачи прошлых дней: {day.data.unresolvedPreviousDays.length}.
              </div>
            ) : null}
            <TaskGroup
              title="Просроченные"
              tasks={day.data?.mandatory.overdue ?? []}
              onAdd={addTaskToDay}
            />
            <TaskGroup
              title="Срок сегодня"
              tasks={day.data?.mandatory.dueToday ?? []}
              onAdd={addTaskToDay}
            />
            <TaskItemGroup
              title="Запланировано без времени"
              items={unscheduledItems}
              date={date}
              completeItem={(id) => completeItem.mutate(id)}
              removeItem={(id) => removeItem.mutate(id)}
              unscheduleItem={(id) => unscheduleItem.mutate(id)}
              scheduleExistingItem={scheduleExistingItem}
              updateDuration={(item, duration) =>
                updateItem.mutate({
                  id: item.id,
                  input: { estimatedDurationMinutes: duration },
                })
              }
            />
          </Panel>
        </section>

        <section className={`${mobileTab === 'schedule' ? 'block' : 'hidden'} lg:block`}>
          <Panel title="План дня и временная шкала">
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDropOnPlan}
              className="mb-4 rounded-lg border border-dashed border-[var(--line)] p-3 text-sm text-[var(--muted)]"
            >
              Перетащи сюда задачу, чтобы добавить её в день без времени.
            </div>

            <div className="grid gap-2">
              {timelineSlots.map((time) => {
                const slotItems = scheduledItems.filter((item) => hourSlot(item.scheduledStartAt) === time);
                return (
                  <div
                    key={time}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleDropOnSlot(event, time)}
                    className={isFocus ? 'grid min-h-14 grid-cols-[64px_1fr] gap-3 border-b border-[var(--focus-border-soft)] py-2' : 'grid min-h-16 grid-cols-[64px_1fr] gap-3 rounded-lg border border-[var(--line)] bg-[var(--background)] p-2'}
                  >
                    <div className="pt-2 text-xs font-medium text-[var(--muted)]">{time}</div>
                    <div className="grid gap-2">
                      {slotItems.length ? (
                        slotItems.map((item) => (
                          <PlanItemCard
                            key={item.id}
                            item={item}
                            date={date}
                            onComplete={() => completeItem.mutate(item.id)}
                            onRemove={() => removeItem.mutate(item.id)}
                            onUnschedule={() => unscheduleItem.mutate(item.id)}
                            onSchedule={(start, duration) => scheduleExistingItem(item, start, duration)}
                            onDuration={(duration) =>
                              updateItem.mutate({
                                id: item.id,
                                input: { estimatedDurationMinutes: duration },
                              })
                            }
                          />
                        ))
                      ) : (
                        <div className="my-day-free-slot rounded-md border border-dashed border-[var(--line)] p-3 text-xs text-[var(--muted)]">
                          {isFocus ? '' : 'Свободный слот'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </section>

        <section className={`${mobileTab === 'add' ? 'block' : 'hidden'} lg:block`}>
          <Panel title="Возможные задачи">
            <div className="mb-3 grid gap-2">
              <label className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-3">
                <Search size={16} className="text-[var(--muted)]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Поиск задач"
                  className="h-10 min-w-0 flex-1 bg-transparent outline-none"
                />
              </label>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as TaskPriority | '')}
                className="h-10 rounded-lg border border-[var(--line)] bg-transparent px-3"
              >
                <option value="">Любой приоритет</option>
                <option value="URGENT">Срочный</option>
                <option value="HIGH">Высокий</option>
                <option value="NORMAL">Обычный</option>
                <option value="LOW">Низкий</option>
              </select>
            </div>

            <div className="grid gap-2">
              {suggestions.data?.map((task) => (
                <TaskPill
                  key={task.id}
                  task={task}
                  action={() => addTaskToDay(task.id)}
                  actionLabel="В день"
                />
              ))}
              {suggestions.data?.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Подходящих задач нет.</p>
              ) : null}
            </div>

            <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--background)] p-3">
              <h3 className="font-medium">Завершить день</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Остаток можно перенести на завтра или вернуть в общий список. Автоматически ничего не переносится.
              </p>
              <div className="mt-3 grid gap-2">
                <button
                  disabled={!incompleteItems.length}
                  onClick={() =>
                    completeDay.mutate({
                      date,
                      actions: incompleteItems.map((item) => ({
                        itemId: item.id,
                        action: 'TOMORROW',
                      })),
                    })
                  }
                  className="rounded-lg bg-[var(--foreground)] px-3 py-2 text-sm text-[var(--background)] disabled:opacity-50"
                >
                  Все незавершённые на завтра
                </button>
                <button
                  disabled={!incompleteItems.length}
                  onClick={() =>
                    completeDay.mutate({
                      date,
                      actions: incompleteItems.map((item) => ({
                        itemId: item.id,
                        action: 'BACKLOG',
                      })),
                    })
                  }
                  className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm disabled:opacity-50"
                >
                  Все вернуть в общий список
                </button>
              </div>
            </div>
          </Panel>
        </section>
      </div>

      {day.error || suggestions.error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {(day.error || suggestions.error)?.message}
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-3">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <CalendarDays size={18} />
        {title}
      </h2>
      {children}
    </section>
  );
}

function TaskGroup({
  title,
  tasks,
  onAdd,
}: {
  title: string;
  tasks: Task[];
  onAdd: (id: string) => void;
}) {
  if (!tasks.length) return null;
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-sm font-medium text-[var(--muted)]">{title}</h3>
      <div className="grid gap-2">
        {tasks.map((task) => (
          <TaskPill
            key={task.id}
            task={task}
            action={() => onAdd(task.id)}
            actionLabel="В план"
          />
        ))}
      </div>
    </div>
  );
}

function TaskItemGroup({
  title,
  items,
  date,
  completeItem,
  removeItem,
  unscheduleItem,
  scheduleExistingItem,
  updateDuration,
}: {
  title: string;
  items: DailyPlanItem[];
  date: string;
  completeItem: (id: string) => void;
  removeItem: (id: string) => void;
  unscheduleItem: (id: string) => void;
  scheduleExistingItem: (item: DailyPlanItem, time: string, duration: number) => void;
  updateDuration: (item: DailyPlanItem, duration: number) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-sm font-medium text-[var(--muted)]">{title}</h3>
      <div className="grid gap-2">
        {items.map((item) => (
          <PlanItemCard
            key={item.id}
            item={item}
            date={date}
            onComplete={() => completeItem(item.id)}
            onRemove={() => removeItem(item.id)}
            onUnschedule={() => unscheduleItem(item.id)}
            onSchedule={(start, duration) => scheduleExistingItem(item, start, duration)}
            onDuration={(duration) => updateDuration(item, duration)}
            compact
          />
        ))}
      </div>
    </div>
  );
}
