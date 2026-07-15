'use client';

import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import ruLocale from '@fullcalendar/core/locales/ru';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';
import { Page } from '@/components/page';
import { useUiMode } from '@/components/ui-mode-provider';
import { api } from '@/lib/api';
import { Task } from '@/lib/types';

export default function CalendarPage() {
  const { interfaceMode } = useUiMode();
  const isFocus = interfaceMode === 'focus';
  const queryClient = useQueryClient();
  const tasks = useQuery({ queryKey: ['calendar'], queryFn: api.calendar });
  const move = useMutation({
    mutationFn: ({ id, dueAt }: { id: string; dueAt: string }) => api.updateTask(id, { dueAt }),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const events = (tasks.data ?? []).map((task) => ({
    id: task.id,
    title: task.title,
    start: task.dueAt ?? undefined,
    url: `/tasks/${task.id}`,
    backgroundColor: eventColor(task),
    borderColor: 'transparent',
    extendedProps: { priority: task.priority, status: task.status },
  }));

  if (!isFocus) {
    return (
      <Page title="Календарь" description="Задачи с установленным сроком.">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 shadow-sm">
          <Calendar events={events} move={move.mutate} />
        </div>
      </Page>
    );
  }

  return (
    <Page title="Календарь" description="Месяц, неделя и день в едином Focus-стиле.">
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <section className="rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface)] p-4 shadow-sm">
          <Calendar events={events} move={move.mutate} focus />
        </section>
        <aside className="grid content-start gap-4">
          <section className="rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface)] p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <SlidersHorizontal size={18} className="text-[var(--focus-primary)]" />
              <h2 className="font-semibold">Фильтры</h2>
            </div>
            <div className="grid gap-3 text-sm text-[var(--focus-text-secondary)]">
              <label className="flex items-center justify-between rounded-xl bg-[var(--focus-surface-secondary)] p-3">
                Все проекты <input type="checkbox" defaultChecked />
              </label>
              <label className="flex items-center justify-between rounded-xl bg-[var(--focus-surface-secondary)] p-3">
                Фиксированные задачи <input type="checkbox" defaultChecked />
              </label>
              <label className="flex items-center justify-between rounded-xl bg-[var(--focus-surface-secondary)] p-3">
                Гибкие задачи <input type="checkbox" defaultChecked />
              </label>
            </div>
          </section>
          <section className="rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-primary-soft)] p-5">
            <p className="text-sm font-semibold text-[var(--focus-primary)]">Подсказка</p>
            <p className="mt-2 text-sm text-[var(--focus-text-secondary)]">
              В месяце показывается overflow “+ ещё N”, а неделя и день открываются с рабочего времени.
            </p>
          </section>
        </aside>
      </div>
    </Page>
  );
}

function Calendar({
  events,
  move,
  focus,
}: {
  events: Array<{
    id: string;
    title: string;
    start?: string;
    url: string;
    backgroundColor: string;
    borderColor: string;
    extendedProps: Record<string, string>;
  }>;
  move: (input: { id: string; dueAt: string }) => void;
  focus?: boolean;
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
      eventDrop={(arg) => {
        if (!arg.event.start) return;
        move(
          { id: arg.event.id, dueAt: arg.event.start.toISOString() },
        );
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
  return '#356fe8';
}
