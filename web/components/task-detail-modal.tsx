'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FolderKanban,
  ListChecks,
  Pencil,
  RotateCcw,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { invalidateTaskCaches } from '@/lib/cache';
import { dueModeLabel, formatDate, formatDueDate, priorityLabel, statusLabel, taskKindLabel } from '@/lib/labels';
import { Task, TaskChecklistItem } from '@/lib/types';
import { AttachmentPanel } from './attachment-panel';
import { TaskChecklist as TaskChecklistPanel } from './task-checklist';
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
      void invalidateTaskCaches(queryClient, taskId);
    },
  });

  const reopen = useMutation({
    mutationFn: () => api.updateTask(taskId, { status: 'IN_PROGRESS' }),
    onSuccess: () => {
      void invalidateTaskCaches(queryClient, taskId);
    },
  });

  const remove = useMutation({
    mutationFn: () => api.deleteTask(taskId),
    onSuccess: () => {
      void invalidateTaskCaches(queryClient, taskId);
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
  const incompleteChecklistItems = data?.checklistItems?.filter((item) => !item.isCompleted).length ?? 0;

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
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--focus-border-soft,var(--line))] bg-[var(--focus-surface-secondary,var(--panel))] px-2.5 py-1 font-semibold text-[var(--foreground)]">
                  <FolderKanban size={13} />
                  {data.project.name}
                </span>
              ) : (
                <span className="rounded-full border border-[var(--focus-border-soft,var(--line))] bg-[var(--focus-surface-secondary,var(--panel))] px-2.5 py-1 font-medium text-[var(--muted)]">
                  Без проекта
                </span>
              )}
        </>
      }
      title={data?.title ?? 'Загружаю задачу…'}
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
            <div className="grid gap-5">
              <TaskForm
                task={data}
                onDone={() => {
                  setEditing(false);
                  queryClient.invalidateQueries({ queryKey: ['task', taskId] });
                }}
              />
              <TaskChecklistPanel task={data} />
            </div>
          ) : null}

          {data && !editing ? (
            <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="grid min-w-0 gap-5">
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)]/45 p-5">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Описание
                  </h3>
                  <p className="whitespace-pre-wrap leading-7">
                    {data.description?.trim() || 'Описание пока не указано.'}
                  </p>
                </div>

                <TaskChecklistPanel task={data} />

                <AttachmentPanel taskId={taskId} title="Файлы задачи" />
              </section>

              <aside className="grid min-w-0 content-start gap-4">
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)]/45 p-4">
                  <h3 className="mb-3 font-semibold">Сводка</h3>
                  <div className="grid gap-2">
                    <InfoRow icon={<CheckCircle2 size={16} />} label="Статус" value={statusLabel[data.status]} />
                    <InfoRow label="Приоритет" value={priorityLabel[data.priority]} tone={priorityTone(data.priority)} />
                    <InfoRow icon={<CalendarClock size={16} />} label="Срок" value={formatDueDate(data.dueAt, data.dueDateType)} />
                    <InfoRow icon={<Clock3 size={16} />} label="Оценка" value={data.estimatedDurationMinutes ? `${data.estimatedDurationMinutes} мин` : 'Без оценки'} />
                    <InfoRow label="Режим срока" value={dueModeLabel(data.dueDateType)} />
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
                        onClick={() => {
                          if (
                            incompleteChecklistItems > 0 &&
                            !window.confirm(`В чек-листе осталось ${incompleteChecklistItems}. Всё равно завершить задачу?`)
                          ) {
                            return;
                          }
                          complete.mutate();
                        }}
                        disabled={complete.isPending}
                        className="btn-base btn-success h-11"
                      >
                        <CheckCircle2 size={17} />
                        Завершить
                      </button>
                    ) : null}
                    {data.status === 'COMPLETED' && !data.deletedAt ? (
                      <button
                        type="button"
                        onClick={() => reopen.mutate()}
                        disabled={reopen.isPending}
                        className="btn-base btn-secondary h-11"
                      >
                        <RotateCcw size={17} />
                        Вернуть в работу
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
                  {(complete.error || reopen.error || remove.error) ? (
                    <p className="mt-3 text-sm text-red-500">
                      {(complete.error || reopen.error || remove.error)?.message}
                    </p>
                  ) : null}
                </div>
              </aside>
            </div>
          ) : null}
    </EntityDrawer>
  );
}

function TaskChecklist({ task }: { task: Task }) {
  const queryClient = useQueryClient();
  const items = task.checklistItems ?? [];
  const completed = items.filter((item) => item.isCompleted).length;
  const [drafts, setDrafts] = useState(['']);

  const syncTask = async (updatedTask: Task) => {
    queryClient.setQueryData(['task', task.id], updatedTask);
    await invalidateTaskCaches(queryClient, task.id);
  };

  const createItem = useMutation({
    mutationFn: (title: string) => api.createTaskChecklistItem(task.id, title),
  });

  const updateItem = useMutation({
    mutationFn: ({
      itemId,
      input,
    }: {
      itemId: string;
      input: { title?: string; isCompleted?: boolean };
    }) => api.updateTaskChecklistItem(task.id, itemId, input),
    onSuccess: syncTask,
  });

  const deleteItem = useMutation({
    mutationFn: (itemId: string) => api.deleteTaskChecklistItem(task.id, itemId),
    onSuccess: syncTask,
  });

  function changeDraft(index: number, value: string) {
    setDrafts((current) => {
      const next = [...current];
      next[index] = value;
      if (value.trim() && index === next.length - 1) next.push('');
      while (next.length > 1 && !next[next.length - 1].trim() && !next[next.length - 2].trim()) {
        next.pop();
      }
      return next;
    });
  }

  function commitDraft(index: number) {
    const title = drafts[index]?.trim();
    if (!title) return;
    setDrafts((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      return next.length ? next : [''];
    });
    createItem.mutate(title, {
      onSuccess: (updatedTask) => {
        void syncTask(updatedTask);
      },
    });
  }

  const busy = createItem.isPending || updateItem.isPending || deleteItem.isPending;
  const error = createItem.error || updateItem.error || deleteItem.error;

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)]/45 p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          <ListChecks size={17} />
          Чек-лист
        </h3>
        {items.length ? (
          <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">
            {completed}/{items.length}
          </span>
        ) : null}
      </div>

      <div className="grid gap-1.5" data-checklist>
        {items.map((item) => (
          <ChecklistItemRow
            key={item.id}
            item={item}
            disabled={busy}
            onToggle={(isCompleted) =>
              updateItem.mutate({ itemId: item.id, input: { isCompleted } })
            }
            onRename={(title) =>
              updateItem.mutate({ itemId: item.id, input: { title } })
            }
            onDelete={() => deleteItem.mutate(item.id)}
          />
        ))}

        {drafts.map((draft, index) => (
          <div key={index} className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition focus-within:bg-[var(--panel)]">
            <span className="h-4 w-4 shrink-0 rounded border border-dashed border-[var(--line)]" />
            <input
              value={draft}
              onChange={(event) => changeDraft(index, event.target.value)}
              onBlur={(event) => {
                if (event.currentTarget.dataset.skipCommit === 'true') {
                  delete event.currentTarget.dataset.skipCommit;
                  return;
                }
                commitDraft(index);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.currentTarget.dataset.skipCommit = 'true';
                  commitDraft(index);
                  const next = event.currentTarget
                    .closest('[data-checklist]')
                    ?.querySelectorAll<HTMLInputElement>('input[data-checklist-draft]');
                  window.setTimeout(() => next?.[index + 1]?.focus(), 0);
                }
              }}
              disabled={busy}
              data-checklist-draft
              placeholder={index === 0 && !items.length ? 'Добавить первый пункт…' : 'Новый пункт…'}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
            />
          </div>
        ))}
      </div>

      {error ? <p className="mt-3 text-sm text-red-500">{error.message}</p> : null}
    </div>
  );
}

function ChecklistItemRow({
  item,
  disabled,
  onToggle,
  onRename,
  onDelete,
}: {
  item: TaskChecklistItem;
  disabled: boolean;
  onToggle: (isCompleted: boolean) => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(item.title);

  useEffect(() => {
    setTitle(item.title);
  }, [item.title]);

  function commitTitle() {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setTitle(item.title);
      return;
    }
    if (cleanTitle !== item.title) onRename(cleanTitle);
  }

  return (
    <div
      className={`group flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-[var(--panel)] ${
        item.isCompleted ? 'opacity-55' : ''
      }`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onToggle(!item.isCompleted)}
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
          item.isCompleted
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-[var(--line)] hover:border-[var(--accent)]'
        }`}
        aria-label={item.isCompleted ? 'Вернуть пункт' : 'Отметить пункт'}
      >
        {item.isCompleted ? <CheckCircle2 size={13} /> : null}
      </button>
      <input
        value={title}
        disabled={disabled}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={commitTitle}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commitTitle();
            event.currentTarget.blur();
          }
        }}
        className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${
          item.isCompleted ? 'text-[var(--muted)] line-through' : ''
        }`}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={onDelete}
        className="rounded-lg p-1.5 text-[var(--muted)] opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
        aria-label="Удалить пункт"
      >
        <X size={15} />
      </button>
    </div>
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
