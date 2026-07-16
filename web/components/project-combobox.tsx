'use client';

import { ChevronDown, FolderKanban, Search, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { Project } from '@/lib/types';

export function ProjectCombobox({
  projects,
  value,
  onChange,
  className = '',
  placeholder = 'Без проекта',
}: {
  projects?: Project[];
  value: string;
  onChange: (projectId: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selected = projects?.find((project) => project.id === value) ?? null;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredProjects = useMemo(() => {
    const list = projects ?? [];
    if (!normalizedQuery) return list;
    return list.filter((project) =>
      [project.name, project.description ?? ''].some((part) =>
        part.toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [normalizedQuery, projects]);

  function closeSoon() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    blurTimer.current = setTimeout(() => setOpen(false), 120);
  }

  function choose(projectId: string) {
    onChange(projectId);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className={`relative min-w-0 ${className}`}>
      <div
        className="flex h-full min-h-11 items-center gap-2 rounded-xl border border-[var(--line)] bg-transparent px-3 transition-within focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)]"
        onFocus={() => setOpen(true)}
        onBlur={closeSoon}
      >
        <FolderKanban size={16} className="shrink-0 text-[var(--muted)]" />
        <input
          className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
          value={open ? query : selected?.name ?? ''}
          placeholder={selected?.name ?? placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setQuery('');
              setOpen(false);
            }
            if (event.key === 'Enter' && open) {
              event.preventDefault();
              if (filteredProjects[0]) choose(filteredProjects[0].id);
            }
          }}
        />
        {value ? (
          <button
            type="button"
            className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose('')}
            aria-label="Очистить проект"
          >
            <X size={15} />
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((current) => !current)}
          aria-label="Открыть список проектов"
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[80] overflow-hidden rounded-2xl border border-[var(--focus-border,var(--line))] bg-[var(--focus-surface,var(--panel))] shadow-xl">
          <button
            type="button"
            className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-[var(--accent-soft)] ${
              !value ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'
            }`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose('')}
          >
            <Search size={15} className="text-[var(--muted)]" />
            Без проекта
          </button>
          <div className="max-h-56 overflow-y-auto border-t border-[var(--focus-border-soft,var(--line))] py-1">
            {filteredProjects.length ? (
              filteredProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className={`grid w-full gap-0.5 px-3 py-2 text-left text-sm transition hover:bg-[var(--accent-soft)] ${
                    project.id === value ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'
                  }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(project.id)}
                >
                  <span className="truncate font-medium">{project.name}</span>
                  {project.description ? (
                    <span className="truncate text-xs text-[var(--muted)]">{project.description}</span>
                  ) : null}
                </button>
              ))
            ) : (
              <p className="px-3 py-3 text-sm text-[var(--muted)]">Проект не найден.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
