'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ListChecks, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { invalidateTaskCaches } from '@/lib/cache';
import { Task, TaskChecklistItem } from '@/lib/types';

export function TaskChecklist({ task, compact = false }: { task: Task; compact?: boolean }) {
  const queryClient = useQueryClient();
  const items = task.checklistItems ?? [];
  const completed = items.filter((item) => item.isCompleted).length;
  const [drafts, setDrafts] = useState(['']);
  const skipBlurCommit = useRef(new Set<number>());

  const syncTask = async (updatedTask: Task) => {
    queryClient.setQueryData(['task', task.id], updatedTask);
    await invalidateTaskCaches(queryClient, task.id);
  };

  const createItem = useMutation({
    mutationFn: (title: string) => api.createTaskChecklistItem(task.id, title),
    onSuccess: syncTask,
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
    createItem.mutate(title);
  }

  const busy = createItem.isPending || updateItem.isPending || deleteItem.isPending;
  const error = createItem.error || updateItem.error || deleteItem.error;

  return (
    <div className={`rounded-2xl border border-[var(--line)] bg-[var(--background)]/45 ${compact ? 'p-3' : 'p-5'}`}>
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
              onBlur={() => {
                if (skipBlurCommit.current.has(index)) {
                  skipBlurCommit.current.delete(index);
                  return;
                }
                commitDraft(index);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                skipBlurCommit.current.add(index);
                commitDraft(index);
                window.setTimeout(() => {
                  const inputs = event.currentTarget
                    .closest('[data-checklist]')
                    ?.querySelectorAll<HTMLInputElement>('input[data-checklist-draft]');
                  inputs?.[index + 1]?.focus();
                }, 0);
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

export function ChecklistProgress({ task }: { task: Task }) {
  const total = task.checklistItems?.length ?? 0;
  if (!total) return null;
  const done = task.checklistItems.filter((item) => item.isCompleted).length;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-1 text-xs font-medium text-[var(--accent)]">
      <ListChecks size={13} />
      {done}/{total}
    </span>
  );
}
