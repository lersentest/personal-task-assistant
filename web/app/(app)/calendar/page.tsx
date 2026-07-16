'use client';

import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import ruLocale from '@fullcalendar/core/locales/ru';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Page } from '@/components/page';
import { TaskDetailsModal } from '@/components/task-detail-modal';
import { ErrorState, LoadingState, UiCard } from '@/components/ui-kit';
import { useUiMode } from '@/components/ui-mode-provider';
import { api } from '@/lib/api';
import { priorityLabel, taskKindLabel } from '@/lib/labels';
import { Task, TaskKind, TaskPriority } from '@/lib/types';

export default function CalendarPage() {
  const { interfaceMode } = useUiMode();
  const isFocus = interfaceMode === 'focus';
  const queryClient = useQueryClient();
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [kind, setKind] = useState<TaskKind | ''>('');
  const [flexibility, setFlexibility] = useState<'all' | 'fixed' | 'flexible'>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const tasks = useQuery({ queryKey: ['calendar'], queryFn: api.calendar });
  const move = useMutation({
    mutationFn: ({ id, dueAt }: { id: string; dueAt: string }) => api.updateTask(id, { dueAt }),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const visibleTasks = useMemo(() => {
    return (tasks.data ?? []).filter((task) => {
      if (priority && task.priority !== priority) return false;
      if (kind && task.kind !== kind) return false;
      if (flexibility === 'fixed' && task.isFlexible) return false;
      if (flexibility === 'flexible' && !task.isFlexible) return false;
      return true;
    });
  }, [flexibility, kind, priority, tasks.data]);

  const events = visibleTasks.map((task) => ({
    id: task.id,
    title: `${taskKindLabel[task.kind ?? 'TASK']} · ${task.title}`,
    start: task.dueAt ?? undefined,
    backgroundColor: eventColor(task),
    borderColor: 'transparent',
    extendedProps: { priority: task.priority, status: task.status },
  }));

  if (!isFocus) {
    return (
      <Page title="Календарь" description="Задачи с установленным сроком.">
        {tasks.isLoading ? <LoadingState text="Загружаю календарь…" /> : null}
        {tasks.error ? <ErrorState text={`Не удалось загрузить календарь: ${tasks.error.message}`} /> : null}
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 shadow-sm">
          <Calendar events={events} move={move.mutate} onOpenTask={setSelectedTaskId} />
        </div>
        <TaskDetailsModal taskId={selectedTaskId ?? ''} open={Boolean(selectedTaskId)} onClose={() => setSelectedTaskId(null)} />
      </Page>
    );
  }

  return (
    <Page title="Календарь" description="Месяц, неделя, день и список с фильтрами Focus UI.">
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <UiCard className="p-4">
          {tasks.isLoading ? <LoadingState text="Загружаю календарь…" /> : null}
          {tasks.error ? <ErrorState text={`Не удалось загрузить календарь: ${tasks.error.message}`} /> : null}
          <Calendar events={events} move={move.mutate} focus onOpenTask={setSelectedTaskId} />
        </UiCard>
        <aside className="grid content-start gap-4">
          <section className="rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface)] p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <SlidersHorizontal size={18} className="text-[var(--focus-primary)]" />
              <h2 className="font-semibold">Фильтры</h2>
            </div>
            <div className="grid gap-3 text-sm text-[var(--focus-text-secondary)]">
              <label className="grid gap-1">
                <span className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--focus-text-muted)]">Приоритет</span>
                <select className="h-11 rounded-xl border border-[var(--focus-border)] bg-[var(--focus-surface-secondary)] px-3" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority | '')}>
                  <option value="">Все приоритеты</option>
                  {(['URGENT', 'HIGH', 'NORMAL', 'LOW'] as TaskPriority[]).map((value) => (
                    <option key={value} value={value}>{priorityLabel[value]}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--focus-text-muted)]">Тип</span>
                <select className="h-11 rounded-xl border border-[var(--focus-border)] bg-[var(--focus-surface-secondary)] px-3" value={kind} onChange={(event) => setKind(event.target.value as TaskKind | '')}>
                  <option value="">Все типы</option>
                  {(['TASK', 'CALL', 'MEETING', 'IDEA', 'NOTE'] as TaskKind[]).map((value) => (
                    <option key={value} value={value}>{taskKindLabel[value]}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--focus-text-muted)]">Планирование</span>
                <select className="h-11 rounded-xl border border-[var(--focus-border)] bg-[var(--focus-surface-secondary)] px-3" value={flexibility} onChange={(event) => setFlexibility(event.target.value as typeof flexibility)}>
                  <option value="all">Все задачи</option>
                  <option value="fixed">Фиксированные</option>
                  <option value="flexible">Гибкие</option>
                </select>
              </label>
              <div className="rounded-xl bg-[var(--focus-surface-secondary)] p-3">
                <p className="text-xs text-[var(--focus-text-muted)]">Показано</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--focus-text)]">{visibleTasks.length}</p>
              </div>
            </div>
          </section>
          <section className="rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-primary-soft)] p-5">
            <p className="text-sm font-semibold text-[var(--focus-primary)]">Подсказка</p>
            <p className="mt-2 text-sm text-[var(--focus-text-secondary)]">
              Месяц показывает компактные задачи, неделя и день — рабочую сетку 07:00–21:00. Задачи можно перетаскивать на другое время.
            </p>
          </section>
        </aside>
      </div>
      <TaskDetailsModal taskId={selectedTaskId ?? ''} open={Boolean(selectedTaskId)} onClose={() => setSelectedTaskId(null)} />
    </Page>
  );
}

function Calendar({
  events,
  move,
  focus,
  onOpenTask,
}: {
  events: Array<{
    id: string;
    title: string;
    start?: string;
    backgroundColor: string;
    borderColor: string;
    extendedProps: Record<string, string>;
  }>;
  move: (input: { id: string; dueAt: string }) => void;
  focus?: boolean;
  onOpenTask: (id: string) => void;
}) {
  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
      locales={[ruLocale]}
      locale="ru"
      firstDay={1}
      initialView="dayGridMonth"
      headerToolbar={{
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
      }}
      buttonText={{ today: 'Сегодня', month: 'Месяц', week: 'Неделя', day: 'День', list: 'Список' }}
      editable
      selectable
      nowIndicator
      dayMaxEvents={focus ? 3 : true}
      moreLinkText={(count) => `+ ещё ${count}`}
      height="auto"
      slotMinTime="07:00:00"
      slotMaxTime="21:00:00"
      allDaySlot={false}
      slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
      eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
      views={{
        timeGridWeek: { slotDuration: '00:30:00' },
        timeGridDay: { slotDuration: '00:30:00' },
      }}
      events={events}
      eventClick={(arg) => {
        arg.jsEvent.preventDefault();
        onOpenTask(arg.event.id);
      }}
      eventDrop={(arg) => {
        if (!arg.event.start) return;
        move({ id: arg.event.id, dueAt: arg.event.start.toISOString() });
      }}
      eventResize={(arg) => {
        if (!arg.event.start) return;
        move({ id: arg.event.id, dueAt: arg.event.start.toISOString() });
      }}
    />
  );
}

function eventColor(task: Task) {
  if (task.priority === 'URGENT') return '#ef4444';
  if (task.priority === 'HIGH') return '#f97316';
  if (task.status === 'COMPLETED') return '#22c55e';
  if (task.kind === 'MEETING' || task.kind === 'CALL') return '#8b5cf6';
  return '#356fe8';
}
