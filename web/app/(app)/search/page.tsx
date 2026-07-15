'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Page } from '@/components/page';
import { useUiMode } from '@/components/ui-mode-provider';
import { api } from '@/lib/api';

export default function SearchPage() {
  const { interfaceMode } = useUiMode();
  const isFocus = interfaceMode === 'focus';
  const [query, setQuery] = useState('');
  const search = useQuery({ queryKey: ['search'], queryFn: () => api.search() });
  const filteredTasks = useMemo(() => (search.data?.tasks ?? []).filter((task) => task.title.toLowerCase().includes(query.toLowerCase())), [query, search.data]);
  const filteredProjects = useMemo(() => (search.data?.projects ?? []).filter((project) => project.name.toLowerCase().includes(query.toLowerCase())), [query, search.data]);

  return (
    <Page title="Поиск" description="Задачи, проекты и файлы в одном месте.">
      <input
        className={isFocus ? 'mb-6 h-14 w-full rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface)] px-5 shadow-sm outline-none focus:border-[var(--focus-primary)]' : 'mb-6 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 outline-none focus:border-[var(--accent)]'}
        placeholder="Введите запрос..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoFocus
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className={isFocus ? 'rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface)] p-5 shadow-sm' : 'grid content-start gap-3'}>
          <h2 className="mb-3 font-semibold">Задачи</h2>
          <div className="grid gap-3">
            {filteredTasks.map((task) => <Link key={task.id} href={`/tasks/${task.id}`} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 hover:border-[var(--accent)]">{task.title}</Link>)}
          </div>
        </section>
        <section className={isFocus ? 'rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface)] p-5 shadow-sm' : 'grid content-start gap-3'}>
          <h2 className="mb-3 font-semibold">Проекты</h2>
          <div className="grid gap-3">
            {filteredProjects.map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 hover:border-[var(--accent)]">{project.name}</Link>)}
          </div>
        </section>
      </div>
    </Page>
  );
}
