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
import { useEffect, useMemo, useState } from 'react';
import { TaskModalLink } from '@/components/task-detail-modal';
import { TimeStepSelect } from '@/components/time-step-select';
import { MetricStrip, PriorityBadge } from '@/components/ui-kit';
import { useUiMode } from '@/components/ui-mode-provider';
import { api } from '@/lib/api';
import { formatDueDate, taskKindLabel } from '@/lib/labels';
import { DailyPlanItem, MyDayData, Task, TaskPriority } from '@/lib/types';

const durationOptions = [15, 30, 45, 60, 90, 120, 180, 240];
const timelineStartHour = 7;
const timelineEndHour = 20;
const timelineHourHeight = 72;
const timelineStepMinutes = 15;

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

function dateTimeFor(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function addMinutes(dateIso: string, minutes: number) {
  return new Date(new Date(dateIso).getTime() + minutes * 60_000).toISOString();
}

function minutesOfDay(value: string | null) {
  if (!value) return 0;
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes();
}

function roundToStep(minutes: number, step = timelineStepMinutes) {
  return Math.max(
    timelineStartHour * 60,
    Math.min((timelineEndHour * 60) - step, Math.round(minutes / step) * step),
  );
}

function timeFromMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function taskKindTone(kind: Task['kind']) {
  if (kind === 'CALL') return 'bg-sky-50 text-sky-700 dark:bg-sky-950/35 dark:text-sky-200';
  if (kind === 'MEETING') return 'bg-purple-50 text-purple-700 dark:bg-purple-950/35 dark:text-purple-200';
  if (kind === 'IDEA') return 'bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-200';
  if (kind === 'NOTE') return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
  return 'bg-blue-50 text-blue-700 dark:bg-blue-950/35 dark:text-blue-200';
}

function TaskKindBadge({ kind }: { kind: Task['kind'] }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${taskKindTone(kind)}`}>
      {taskKindLabel[kind ?? 'TASK']}
    </span>
  );
}

function compactTaskMeta(task: Task, duration?: number) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <TaskKindBadge kind={task.kind ?? 'TASK'} />
      <PriorityBadge priority={task.priority} />
      {duration ? (
        <span className="rounded-full bg-[var(--focus-surface-secondary,var(--background))] px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
          {formatMinutes(duration)}
        </span>
      ) : null}
      {task.project ? (
        <span className="rounded-full bg-[var(--focus-surface-secondary,var(--background))] px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
          {task.project.name}
        </span>
      ) : null}
    </div>
  );
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
          <TaskModalLink task={task} className={isFocus ? 'text-left text-sm font-semibold hover:text-[var(--focus-primary)]' : 'text-left font-medium hover:text-[var(--accent)]'}>
            {task.title}
          </TaskModalLink>
          <div className="mt-1 text-xs text-[var(--muted)]">{formatDueDate(task.dueAt, task.dueDateType)}</div>
          {compactTaskMeta(task, task.estimatedDurationMinutes ?? undefined)}
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
  timeline = false,
}: {
  item: DailyPlanItem;
  date: string;
  onComplete: () => void;
  onRemove: () => void;
  onUnschedule: () => void;
  onSchedule: (start: string, duration: number) => void;
  onDuration: (duration: number) => void;
  compact?: boolean;
  timeline?: boolean;
}) {
  const { interfaceMode } = useUiMode();
  const isFocus = interfaceMode === 'focus';
  const [time, setTime] = useState(formatTime(item.scheduledStartAt) || '09:00');
  const [editingTime, setEditingTime] = useState(false);
  const duration = item.task.estimatedDurationMinutes ?? 30;
  const done = item.completedInPlanAt || item.task.status === 'COMPLETED';

  useEffect(() => {
    setTime(formatTime(item.scheduledStartAt) || '09:00');
  }, [item.scheduledStartAt]);

  return (
    <article
      draggable
      onDragStart={(event) => event.dataTransfer.setData('text/plain', `item:${item.id}`)}
      className={`group min-w-0 overflow-hidden border ${timeline ? 'h-full' : ''} ${
        isFocus
          ? `rounded-xl ${timeline ? 'px-3 py-2' : 'px-3 py-2.5'} shadow-none ${
              done
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/25 dark:text-emerald-100'
                : item.scheduledStartAt
                  ? 'border-blue-200 bg-blue-50 dark:bg-blue-950/25'
                  : 'border-[var(--focus-border-soft)] bg-[var(--focus-surface)]'
            }`
          : `rounded-lg ${timeline ? 'p-2' : 'p-3'} shadow-sm ${
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
          <TaskModalLink task={item.task} className={isFocus ? 'text-left text-sm font-semibold hover:text-[var(--focus-primary)]' : 'text-left font-medium hover:text-[var(--accent)]'}>
            {item.task.title}
          </TaskModalLink>
          <div className={isFocus ? 'mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-[var(--focus-text-muted)]' : 'mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]'}>
            {item.scheduledStartAt ? (
              <span className="inline-flex items-center gap-1">
                <Clock size={13} />
                {formatTime(item.scheduledStartAt)}–{formatTime(item.scheduledEndAt)}
              </span>
            ) : (
              <span>Без времени</span>
            )}
          </div>
          {!timeline || duration >= 30 ? compactTaskMeta(item.task, duration) : null}
        </div>
        <div className="flex shrink-0 gap-1">
          {!done ? (
            <button onClick={onComplete} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-emerald-600 transition hover:border-emerald-200 hover:bg-emerald-50 active:scale-95" title="Выполнить" aria-label="Выполнить">
              <CheckCircle2 size={18} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setEditingTime((value) => !value)}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-transparent px-2 text-xs font-medium text-blue-600 transition hover:border-blue-200 hover:bg-blue-50 active:scale-95"
          >
            Время
          </button>
          <button onClick={onRemove} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-95" title="Убрать из дня" aria-label="Убрать из дня">
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      {editingTime ? (
        <>
      <div className="mt-3 grid gap-2 rounded-xl border border-[var(--focus-border-soft,var(--line))] bg-[var(--focus-surface-secondary,var(--background))] p-2 sm:grid-cols-[1fr_1fr_auto_auto]">
        <TimeStepSelect
          value={time}
          onChange={setTime}
          minuteStep={15}
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
          onClick={() => {
            onSchedule(time, duration);
            setEditingTime(false);
          }}
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
        </>
      ) : null}
    </article>
  );
}

type TimelineLayout = {
  item: DailyPlanItem;
  top: number;
  height: number;
  left: number;
  width: number;
};

function buildTimelineLayout(items: DailyPlanItem[]): TimelineLayout[] {
  const positioned = items
    .filter((item) => item.scheduledStartAt && item.scheduledEndAt)
    .map((item) => {
      const start = Math.max(minutesOfDay(item.scheduledStartAt), timelineStartHour * 60);
      const end = Math.min(minutesOfDay(item.scheduledEndAt), timelineEndHour * 60);
      return { item, start, end: Math.max(end, start + 15) };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const result: TimelineLayout[] = [];
  let group: typeof positioned = [];
  let groupEnd = 0;

  function flushGroup() {
    if (!group.length) return;
    const columnsEnd: number[] = [];
    const assignments = group.map((entry) => {
      const column = columnsEnd.findIndex((end) => end <= entry.start);
      const nextColumn = column === -1 ? columnsEnd.length : column;
      columnsEnd[nextColumn] = entry.end;
      return { ...entry, column: nextColumn };
    });
    const columns = Math.max(1, columnsEnd.length);
    assignments.forEach((entry) => {
      result.push({
        item: entry.item,
        top: ((entry.start - timelineStartHour * 60) / 60) * timelineHourHeight,
        height: Math.max(44, ((entry.end - entry.start) / 60) * timelineHourHeight),
        left: (entry.column / columns) * 100,
        width: 100 / columns,
      });
    });
    group = [];
    groupEnd = 0;
  }

  positioned.forEach((entry) => {
    if (!group.length || entry.start < groupEnd) {
      group.push(entry);
      groupEnd = Math.max(groupEnd, entry.end);
    } else {
      flushGroup();
      group.push(entry);
      groupEnd = entry.end;
    }
  });
  flushGroup();
  return result;
}

function TimelineBoard({
  items,
  date,
  onComplete,
  onRemove,
  onUnschedule,
  onSchedule,
  onDuration,
  onDropAt,
}: {
  items: DailyPlanItem[];
  date: string;
  onComplete: (id: string) => void;
  onRemove: (id: string) => void;
  onUnschedule: (id: string) => void;
  onSchedule: (item: DailyPlanItem, time: string, duration: number) => void;
  onDuration: (item: DailyPlanItem, duration: number) => void;
  onDropAt: (event: React.DragEvent, time: string) => void;
}) {
  const layout = buildTimelineLayout(items);
  const totalHeight = (timelineEndHour - timelineStartHour) * timelineHourHeight;
  const hours = Array.from(
    { length: timelineEndHour - timelineStartHour + 1 },
    (_, index) => timelineStartHour + index,
  );

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    const minutes = roundToStep(timelineStartHour * 60 + ratio * (timelineEndHour - timelineStartHour) * 60);
    onDropAt(event, timeFromMinutes(minutes));
  }

  return (
    <div className="rounded-2xl border border-[var(--focus-border-soft,var(--line))] bg-[var(--background)]/35 p-3">
      <div className="relative" style={{ height: totalHeight }}>
        {hours.map((hour) => {
          const top = ((hour - timelineStartHour) * timelineHourHeight);
          return (
            <div key={hour} className="absolute left-0 right-0" style={{ top }}>
              <div className="grid grid-cols-[54px_1fr] gap-3">
                <div className="-translate-y-2 text-xs font-medium text-[var(--muted)]">
                  {String(hour).padStart(2, '0')}:00
                </div>
                <div className="border-t border-[var(--focus-border-soft,var(--line))]" />
              </div>
            </div>
          );
        })}
        <div
          className="absolute bottom-0 left-[66px] right-0 top-0"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          {Array.from({ length: (timelineEndHour - timelineStartHour) * 4 }, (_, index) => (
            <div
              key={index}
              className="absolute left-0 right-0 border-t border-dashed border-[var(--focus-border-soft,var(--line))]/60"
              style={{ top: (index * timelineHourHeight) / 4 }}
            />
          ))}
          {layout.map(({ item, top, height, left, width }) => (
            <div
              key={item.id}
              className="absolute pr-1"
              style={{
                top,
                height,
                left: `${left}%`,
                width: `${width}%`,
              }}
            >
              <PlanItemCard
                item={item}
                date={date}
                onComplete={() => onComplete(item.id)}
                onRemove={() => onRemove(item.id)}
                onUnschedule={() => onUnschedule(item.id)}
                onSchedule={(start, duration) => onSchedule(item, start, duration)}
                onDuration={(duration) => onDuration(item, duration)}
                timeline
              />
            </div>
          ))}
          {!layout.length ? (
            <div className="absolute inset-x-0 top-8 rounded-2xl border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]">
              Перетащи задачу на сетку — время округлится до ближайших 15 минут.
            </div>
          ) : null}
        </div>
      </div>
    </div>
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
      <header className={isFocus ? 'mb-5' : 'mb-5 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Ежедневное планирование</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Мой день</h1>
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
              className="btn-base btn-secondary h-10 w-10 p-0"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setDate(todayLocalDate())}
              className="btn-base btn-secondary h-10 px-4"
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
              className="btn-base btn-secondary h-10 w-10 p-0"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="mt-5">
          <MetricStrip
            items={[
              { label: 'Запланировано', value: formatMinutes(day.data?.summary.estimatedMinutes ?? 0), icon: <Clock size={18} />, tone: 'blue' },
              { label: 'Свободно', value: formatMinutes(Math.max(0, (day.data?.settings.capacityMinutes ?? 480) - (day.data?.summary.estimatedMinutes ?? 0))), icon: <Clock size={18} />, tone: 'green' },
              { label: 'Просрочено', value: day.data?.mandatory.overdue.length ?? 0, icon: <AlertTriangle size={18} />, tone: 'red' },
              { label: 'Выполнено', value: `${day.data?.summary.completedTasks ?? 0} из ${day.data?.summary.totalTasks ?? 0}`, icon: <CheckCircle2 size={18} />, tone: 'green' },
              { label: 'Всего задач', value: day.data?.summary.totalTasks ?? 0, icon: <CalendarDays size={18} />, tone: 'gray' },
            ]}
          />
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

      <div className={isFocus ? 'grid gap-4 lg:grid-cols-[320px_minmax(520px,1fr)_320px]' : 'grid gap-4 lg:grid-cols-[340px_minmax(560px,1fr)_340px]'}>
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

        <section className={`${mobileTab === 'schedule' ? 'block' : 'hidden'} lg:block lg:col-start-2 lg:row-start-1`}>
          <Panel title="План дня и временная шкала">
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDropOnPlan}
              className="mb-4 rounded-2xl border border-dashed border-[var(--line)] p-3 text-sm text-[var(--muted)]"
            >
              Перетащи сюда задачу, чтобы добавить её в день без времени.
            </div>

            <TimelineBoard
              items={scheduledItems}
              date={date}
              onComplete={(id) => completeItem.mutate(id)}
              onRemove={(id) => removeItem.mutate(id)}
              onUnschedule={(id) => unscheduleItem.mutate(id)}
              onSchedule={scheduleExistingItem}
              onDuration={(item, duration) =>
                updateItem.mutate({
                  id: item.id,
                  input: { estimatedDurationMinutes: duration },
                })
              }
              onDropAt={handleDropOnSlot}
            />
          </Panel>
        </section>

        <section className={`${mobileTab === 'add' ? 'block' : 'hidden'} lg:block lg:col-start-3 lg:row-start-1`}>
          <Panel title="Можно добавить">
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

            {day.data?.unresolvedPreviousDays.length ? (
              <div className="mt-4 rounded-2xl border border-[var(--focus-border-soft,var(--line))] bg-[var(--focus-surface-secondary,var(--background))] p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-semibold">Неразобранное</h3>
                  <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--accent)]">
                    {day.data.unresolvedPreviousDays.length}
                  </span>
                </div>
                <div className="grid gap-2">
                  {day.data.unresolvedPreviousDays.slice(0, 3).map((item) => (
                    <div key={item.id} className="rounded-xl bg-[var(--panel)] p-3 text-sm">
                      <p className="font-medium">{item.task.title}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">Осталось с предыдущих дней</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

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
    <div className="rounded-2xl border border-[var(--focus-border,var(--line))] bg-[var(--focus-surface,var(--background))] p-3">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-[var(--focus-border,var(--line))] bg-[var(--focus-surface,var(--panel))] p-4 shadow-sm sm:p-5">
      <h2 className="mb-4 flex items-center gap-2 font-semibold tracking-[-0.02em]">
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
