'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Page } from '@/components/page';
import { TaskModalLink } from '@/components/task-detail-modal';
import { useUiMode } from '@/components/ui-mode-provider';
import { api } from '@/lib/api';

export default function SearchPage() {
  const { interfaceMode } = useUiMode();
  const isFocus = interfaceMode === 'focus';
  const [query, setQuery] = useState('');
  const search = useQuery({ queryKey: ['search'], queryFn: () => api.search() });
  const normalized = query.toLowerCase();
  const filteredTasks = useMemo(
    () => (search.data?.tasks ?? []).filter((task) => task.title.toLowerCase().includes(normalized)),
    [normalized, search.data],
  );
  const filteredDelegatedTasks = useMemo(
    () => (search.data?.delegatedTasks ?? []).filter((task) => task.title.toLowerCase().includes(normalized)),
    [normalized, search.data],
  );
  const filteredProjects = useMemo(
    () => (search.data?.projects ?? []).filter((project) => project.name.toLowerCase().includes(normalized)),
    [normalized, search.data],
  );

  const sectionClass = isFocus
    ? 'rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface)] p-5 shadow-sm'
    : 'grid content-start gap-3';

  return (
    <Page title="Поиск" description="Личные задачи, делегированные задачи, проекты и файлы отдельными группами.">
      <input
        className={isFocus ? 'mb-6 h-14 w-full rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface)] px-5 shadow-sm outline-none focus:border-[var(--focus-primary)]' : 'mb-6 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 outline-none focus:border-[var(--accent)]'}
        placeholder="Введите запрос..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoFocus
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className={sectionClass}>
          <h2 className="mb-3 font-semibold">Личные задачи</h2>
          <div className="grid gap-3">
            {filteredTasks.map((task) => (
              <TaskModalLink
                key={task.id}
                task={task}
                className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 text-left hover:border-[var(--accent)]"
              >
                {task.title}
              </TaskModalLink>
            ))}
          </div>
        </section>
        <section className={sectionClass}>
          <h2 className="mb-3 font-semibold">Делегированные</h2>
          <div className="grid gap-3">
            {filteredDelegatedTasks.map((task) => (
              <Link key={task.id} href="/delegated" className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 hover:border-[var(--accent)]">
                <span className="block font-medium">{task.title}</span>
                <span className="text-sm text-[var(--muted)]">{task.executor.fullName} · {task.status}</span>
              </Link>
            ))}
          </div>
        </section>
        <section className={sectionClass}>
          <h2 className="mb-3 font-semibold">Проекты</h2>
          <div className="grid gap-3">
            {filteredProjects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 hover:border-[var(--accent)]">
                {project.name}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </Page>
  );
}
