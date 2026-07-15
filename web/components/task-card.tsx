import { CheckCircle2, Clock, FolderKanban } from 'lucide-react';
import Link from 'next/link';
import { formatDate, priorityLabel, statusLabel } from '@/lib/labels';
import { Task } from '@/lib/types';
import { useUiMode } from './ui-mode-provider';

export function TaskCard({
  task,
  onComplete,
  onRestore,
}: {
  task: Task;
  onComplete?: (id: string) => void;
  onRestore?: (id: string) => void;
}) {
  const { interfaceMode } = useUiMode();
  const isFocus = interfaceMode === 'focus';
  const priorityTone =
    task.priority === 'URGENT'
      ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200'
      : task.priority === 'HIGH'
        ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-200'
        : task.priority === 'LOW'
          ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200';

  if (isFocus) {
    return (
      <article className="group rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--focus-primary)] hover:shadow-[var(--focus-shadow)]">
        <div className="flex items-start gap-3">
          <span className="mt-1 h-3 w-3 rounded-full border-2 border-[var(--focus-primary)] bg-[var(--focus-surface)]" />
          <div className="min-w-0 flex-1">
            <Link
              href={`/tasks/${task.id}`}
              className="font-semibold leading-snug text-[var(--focus-text)] hover:text-[var(--focus-primary)]"
            >
              {task.title}
            </Link>
            {task.description ? (
              <p className="mt-1 line-clamp-2 text-sm text-[var(--focus-text-secondary)]">
                {task.description}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--focus-text-muted)]">
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--focus-surface-secondary)] px-2 py-1">
                <Clock size={13} />
                {formatDate(task.dueAt)}
              </span>
              <span className={`rounded-full px-2 py-1 ${priorityTone}`}>
                {priorityLabel[task.priority]}
              </span>
              <span className="rounded-full bg-[var(--focus-surface-secondary)] px-2 py-1">
                {statusLabel[task.status]}
              </span>
              {task.estimatedDurationMinutes ? (
                <span className="rounded-full bg-[var(--focus-surface-secondary)] px-2 py-1">
                  {task.estimatedDurationMinutes} мин
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--focus-surface-secondary)] px-2 py-1">
                <FolderKanban size={13} />
                {task.project?.name ?? 'Без проекта'}
              </span>
            </div>
          </div>
          {task.status !== 'COMPLETED' && !task.deletedAt && onComplete ? (
            <button
              onClick={() => onComplete(task.id)}
              className="rounded-xl p-2 text-[var(--focus-text-muted)] opacity-80 transition hover:bg-[var(--focus-primary-soft)] hover:text-[var(--focus-primary)] group-hover:opacity-100"
              title="Выполнить"
            >
              <CheckCircle2 size={19} />
            </button>
          ) : null}
          {task.deletedAt && onRestore ? (
            <button
              onClick={() => onRestore(task.id)}
              className="rounded-xl bg-[var(--focus-primary-soft)] px-3 py-2 text-sm font-medium text-[var(--focus-primary)]"
            >
              Восстановить
            </button>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/tasks/${task.id}`} className="font-medium hover:text-[var(--accent)]">
            {task.title}
          </Link>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
            <span className="inline-flex items-center gap-1"><Clock size={13} />{formatDate(task.dueAt)}</span>
            <span>{statusLabel[task.status]}</span>
            <span>{priorityLabel[task.priority]}</span>
            {task.estimatedDurationMinutes ? <span>{task.estimatedDurationMinutes} мин</span> : null}
            {task.project ? <span className="inline-flex items-center gap-1"><FolderKanban size={13} />{task.project.name}</span> : <span>Без проекта</span>}
          </div>
        </div>
        {task.status !== 'COMPLETED' && !task.deletedAt && onComplete ? (
          <button onClick={() => onComplete(task.id)} className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--accent)]" title="Выполнить">
            <CheckCircle2 size={18} />
          </button>
        ) : null}
        {task.deletedAt && onRestore ? (
          <button onClick={() => onRestore(task.id)} className="rounded-md px-3 py-2 text-sm text-[var(--accent)] hover:bg-[var(--accent-soft)]">
            Восстановить
          </button>
        ) : null}
      </div>
    </article>
  );
}
