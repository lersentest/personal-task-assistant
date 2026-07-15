'use client';

import {
  CheckSquare,
  FileText,
  FolderKanban,
  Lightbulb,
  Phone,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { DelegatedTaskForm } from '@/components/delegated-task-form';
import { ProjectForm } from '@/components/project-form';
import { TaskForm } from '@/components/task-form';
import { taskKindLabel } from '@/lib/labels';
import { TaskKind } from '@/lib/types';

export type CreateEntityState =
  | { entity: 'task'; kind?: TaskKind }
  | { entity: 'project' }
  | { entity: 'delegated' };

const taskKindIcons: Record<TaskKind, typeof CheckSquare> = {
  TASK: CheckSquare,
  CALL: Phone,
  MEETING: Users,
  IDEA: Lightbulb,
  NOTE: FileText,
};

const taskKindDescriptions: Record<TaskKind, string> = {
  TASK: 'Обычная рабочая задача с описанием, сроком и приоритетом.',
  CALL: 'Звонок с клиентом, подрядчиком или участником команды.',
  MEETING: 'Встреча, созвон или фиксированное событие в календаре.',
  IDEA: 'Мысль, гипотеза или будущая возможность без жёсткого срока.',
  NOTE: 'Короткая заметка, которую можно позже превратить в задачу.',
};

export function CreateModalButton({
  entity,
  kind,
  children,
  className,
  title,
}: {
  entity: CreateEntityState['entity'];
  kind?: TaskKind;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        title={title}
      >
        {children}
      </button>
      <CreateEntityModal
        open={open}
        state={entity === 'project' ? { entity: 'project' } : entity === 'delegated' ? { entity: 'delegated' } : { entity: 'task', kind }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export function CreateEntityModal({
  open,
  state,
  onClose,
}: {
  open: boolean;
  state: CreateEntityState;
  onClose: () => void;
}) {
  const [selectedKind, setSelectedKind] = useState<TaskKind>(
    state.entity === 'task' ? (state.kind ?? 'TASK') : 'TASK',
  );

  useEffect(() => {
    if (!open) return;
    if (state.entity === 'task') setSelectedKind(state.kind ?? 'TASK');
  }, [open, state]);

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

  if (!open) return null;

  const isProject = state.entity === 'project';
  const isDelegated = state.entity === 'delegated';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[10000] flex items-stretch justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={onClose}
    >
      <div
        className="flex h-full w-full max-w-4xl flex-col overflow-hidden border border-[var(--focus-border,var(--line))] bg-[var(--focus-surface,var(--panel))] shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-3xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--focus-border-soft,var(--line))] p-4 sm:p-6">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              <Sparkles size={14} />
              Быстрое создание
            </div>
            <h2 className="text-xl font-semibold tracking-[-0.03em] sm:text-2xl">
              {isProject ? 'Новый проект' : isDelegated ? 'Новая делегированная задача' : `Новая: ${taskKindLabel[selectedKind].toLowerCase()}`}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {isProject
                ? 'Создай направление работы и потом привяжи к нему задачи.'
                : isDelegated
                  ? 'Создай отдельную задачу для исполнителя с публичной страницей, комментариями и файлами.'
                  : taskKindDescriptions[selectedKind]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--line)] p-2 text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
            title="Закрыть"
          >
            <X size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {isProject ? (
            <ProjectForm onDone={onClose} />
          ) : isDelegated ? (
            <DelegatedTaskForm onDone={onClose} />
          ) : (
            <div className="grid gap-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {(['TASK', 'CALL', 'MEETING', 'IDEA', 'NOTE'] as TaskKind[]).map((kind) => {
                  const Icon = taskKindIcons[kind];
                  const active = selectedKind === kind;
                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setSelectedKind(kind)}
                      className={`rounded-2xl border p-3 text-left transition ${
                        active
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                          : 'border-[var(--line)] bg-[var(--background)] text-[var(--muted)] hover:border-[var(--accent)]'
                      }`}
                    >
                      <Icon size={18} />
                      <span className="mt-2 block text-sm font-semibold">{taskKindLabel[kind]}</span>
                    </button>
                  );
                })}
              </div>
              <TaskForm key={selectedKind} initialKind={selectedKind} onDone={onClose} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
