import { CheckCircle2, Clock, FolderKanban } from 'lucide-react';
import Link from 'next/link';
import { formatDate, priorityLabel, statusLabel } from '@/lib/labels';
import { Task } from '@/lib/types';

export function TaskCard({
  task,
  onComplete,
  onRestore,
}: {
  task: Task;
  onComplete?: (id: string) => void;
  onRestore?: (id: string) => void;
}) {
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

