'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FolderKanban,
  Pencil,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate, priorityLabel, statusLabel, taskKindLabel } from '@/lib/labels';
import { Task } from '@/lib/types';
import { AttachmentPanel } from './attachment-panel';
import { TaskForm } from './task-form';
import { EntityDrawer } from './ui-kit';

export function TaskModalLink({
  task,
  taskId,
  children,
  className,
  title,
}: {
  task?: Task;
  taskId?: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = task?.id ?? taskId;

  if (!id) return <>{children}</>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        title={title ?? 'Открыть задачу'}
      >
        {children}
      </button>
      <TaskDetailsModal
        taskId={id}
        initialTask={task}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export function TaskDetailsModal({
  taskId,
  initialTask,
  open,
  onClose,
}: {
  taskId: string;
  initialTask?: Task;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const task = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => api.task(taskId),
    enabled: open,
    initialData: initialTask,
  });

  const complete = useMutation({
    mutationFn: () => api.completeTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  const remove = useMutation({
    mutationFn: () => api.deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries();
      onClose();
    },
  });

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) setEditing(false);
  }, [open]);

  if (!open) return null;

  const data = task.data;

  return (
    <EntityDrawer
      open={open}
      onClose={onClose}
      width="max-w-5xl"
      eyebrow={
        <>
              <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 font-medium text-[var(--accent)]">
                {data ? taskKindLabel[data.kind ?? 'TASK'] : 'Задача'}
              </span>
              {data?.project ? (
                <span className="inline-flex items-center gap-1">
                  <FolderKanban size={13} />
                  {data.project.name}
                </span>
              ) : (
                <span>Без проекта</span>
              )}
        </>
      }
      title={data?.title ?? 'Загружаю задачу…'}
      subtitle="Детали задачи, редактирование, файлы и быстрые действия."
      actions={
            <Link
              href={`/tasks/${taskId}`}
              className="btn-base btn-secondary hidden sm:inline-flex"
            >
              <ExternalLink size={16} />
              Страница
            </Link>
      }
    >
          {task.isLoading && !data ? (
            <div className="rounded-2xl border border-dashed border-[var(--line)] p-8 text-center text-[var(--muted)]">
              Загружаю задачу…
            </div>
          ) : null}

          {task.error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {task.error.message}
            </div>
          ) : null}

          {data && editing ? (
            <TaskForm
              task={data}
              onDone={() => {
                setEditing(false);
                queryClient.invalidateQueries({ queryKey: ['task', taskId] });
              }}
            />
          ) : null}

          {data && !editing ? (
            <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
              <section className="grid gap-5">
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)]/45 p-5">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Описание
                  </h3>
                  <p className="whitespace-pre-wrap leading-7">
                    {data.description?.trim() || 'Описание пока не указано.'}
                  </p>
                </div>

                <AttachmentPanel taskId={taskId} title="Файлы задачи" />
              </section>

              <aside className="grid content-start gap-4">
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)]/45 p-4">
                  <h3 className="mb-3 font-semibold">Сводка</h3>
                  <div className="grid gap-2">
                    <InfoRow icon={<CheckCircle2 size={16} />} label="Статус" value={statusLabel[data.status]} />
                    <InfoRow label="Приоритет" value={priorityLabel[data.priority]} tone={priorityTone(data.priority)} />
                    <InfoRow icon={<CalendarClock size={16} />} label="Срок" value={formatDate(data.dueAt)} />
                    <InfoRow icon={<Clock3 size={16} />} label="Оценка" value={data.estimatedDurationMinutes ? `${data.estimatedDurationMinutes} мин` : 'Без оценки'} />
                    <InfoRow label="Планирование" value={data.isFlexible ? 'Гибкая задача' : 'Фиксированное время'} />
                    <InfoRow label="Создана" value={formatDate(data.createdAt)} />
                  </div>
                </div>

                {data.tags?.length ? (
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)]/45 p-4">
                    <h3 className="mb-3 flex items-center gap-2 font-semibold">
                      <Tag size={17} />
                      Теги
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {data.tags.map((item) => (
                        <span key={item.tag.id} className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-sm text-[var(--accent)]">
                          #{item.tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)]/45 p-4">
                  <h3 className="mb-3 font-semibold">Действия</h3>
                  <div className="grid gap-2">
                    {data.status !== 'COMPLETED' && !data.deletedAt ? (
                      <button
                        type="button"
                        onClick={() => complete.mutate()}
                        disabled={complete.isPending}
                        className="btn-base btn-success h-11"
                      >
                        <CheckCircle2 size={17} />
                        Завершить
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="btn-base btn-primary h-11"
                    >
                      <Pencil size={17} />
                      Редактировать
                    </button>
                    {!data.deletedAt ? (
                      <button
                        type="button"
                        onClick={() => remove.mutate()}
                        disabled={remove.isPending}
                        className="btn-base btn-danger h-11"
                      >
                        <Trash2 size={17} />
                        В корзину
                      </button>
                    ) : null}
                  </div>
                  {(complete.error || remove.error) ? (
                    <p className="mt-3 text-sm text-red-500">
                      {(complete.error || remove.error)?.message}
                    </p>
                  ) : null}
                </div>
              </aside>
            </div>
          ) : null}
    </EntityDrawer>
  );
}

function InfoRow({
  icon,
  label,
  value,
  tone,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--panel)] px-3 py-2.5 text-sm">
      <span className="inline-flex items-center gap-2 text-[var(--muted)]">
        {icon}
        {label}
      </span>
      <span className={tone ?? 'font-medium'}>{value}</span>
    </div>
  );
}

function priorityTone(priority: Task['priority']) {
  if (priority === 'URGENT') return 'font-semibold text-red-600';
  if (priority === 'HIGH') return 'font-semibold text-orange-600';
  if (priority === 'LOW') return 'font-semibold text-slate-500';
  return 'font-semibold text-blue-600';
}
