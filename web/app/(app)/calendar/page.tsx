'use client';

import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { EventDropArg } from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Page } from '@/components/page';
import { api } from '@/lib/api';

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const tasks = useQuery({ queryKey: ['calendar'], queryFn: api.calendar });
  const move = useMutation({
    mutationFn: ({ id, dueAt }: { id: string; dueAt: string }) => api.updateTask(id, { dueAt }),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  return (
    <Page title="Календарь" description="Задачи с установленным сроком.">
      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 shadow-sm">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' }}
          editable
          selectable
          height="auto"
          events={(tasks.data ?? []).map((task) => ({
            id: task.id,
            title: task.title,
            start: task.dueAt ?? undefined,
            url: `/tasks/${task.id}`,
            backgroundColor: task.priority === 'URGENT' ? '#dc2626' : task.priority === 'HIGH' ? '#f97316' : '#2563eb',
            borderColor: 'transparent',
          }))}
          eventDrop={(arg: EventDropArg) => {
            if (!arg.event.start) return;
            move.mutate(
              { id: arg.event.id, dueAt: arg.event.start.toISOString() },
              { onError: () => arg.revert() },
            );
          }}
        />
      </div>
    </Page>
  );
}

