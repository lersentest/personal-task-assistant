'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FolderKanban, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { taskKindLabel } from '@/lib/labels';
import { Task, TaskKind } from '@/lib/types';
import { AttachmentPanel } from './attachment-panel';
import { TaskForm, TaskKindCards } from './task-form';

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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedKind, setSelectedKind] = useState<TaskKind>(initialTask?.kind ?? 'TASK');
  const task = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => api.task(taskId),
    enabled: open,
    initialData: initialTask,
  });

  const requestClose = useCallback(() => {
    if (
      hasUnsavedChanges &&
      !window.confirm('Есть несохранённые изменения. Закрыть без сохранения?')
    ) {
      return;
    }
    onClose();
  }, [hasUnsavedChanges, onClose]);

  useEffect(() => {
    if (!open) setHasUnsavedChanges(false);
  }, [open]);

  useEffect(() => {
    if (task.data?.kind) setSelectedKind(task.data.kind);
  }, [task.data?.kind]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, requestClose]);

  if (!open) return null;

  const data = task.data;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[10000] flex items-stretch justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={requestClose}
    >
      <div
        className="flex h-full w-full max-w-4xl flex-col overflow-hidden border border-[var(--focus-border,var(--line))] bg-[var(--focus-surface,var(--panel))] shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-3xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--focus-border-soft,var(--line))] p-4 sm:p-6">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 font-semibold text-[var(--accent)]">
                <Sparkles size={14} />
                Редактирование
              </span>
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
            </div>
            <h2 className="truncate text-xl font-semibold tracking-[-0.03em] text-[var(--foreground)] sm:text-2xl">
              {data?.title ?? 'Загружаю задачу…'}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Измени задачу и нажми «Сохранить». При закрытии без сохранения система предупредит.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/tasks/${taskId}`}
              className="btn-base btn-secondary hidden sm:inline-flex"
            >
              <ExternalLink size={16} />
              Страница
            </Link>
            <button
              type="button"
              onClick={requestClose}
              className="rounded-xl border border-[var(--line)] p-2 text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
              title="Закрыть"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
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

          {data ? (
            <div className="grid gap-5">
              <div className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  Тип
                </span>
                <TaskKindCards value={selectedKind} onChange={setSelectedKind} />
              </div>

              <TaskForm
                task={data}
                kindValue={selectedKind}
                onKindChange={setSelectedKind}
                showKindSelector={false}
                onDone={() => {
                  setHasUnsavedChanges(false);
                  void queryClient.invalidateQueries({ queryKey: ['task', taskId] });
                }}
                onCancel={requestClose}
                onDirtyChange={setHasUnsavedChanges}
              />

              <AttachmentPanel taskId={taskId} title="Файлы задачи" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
