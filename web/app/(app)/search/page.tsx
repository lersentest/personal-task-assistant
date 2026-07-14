'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Page } from '@/components/page';
import { api } from '@/lib/api';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const search = useQuery({ queryKey: ['search'], queryFn: api.search });
  const filteredTasks = useMemo(() => (search.data?.tasks ?? []).filter((task) => task.title.toLowerCase().includes(query.toLowerCase())), [query, search.data]);
  const filteredProjects = useMemo(() => (search.data?.projects ?? []).filter((project) => project.name.toLowerCase().includes(query.toLowerCase())), [query, search.data]);

  return (
    <Page title="Поиск" description="Задачи, проекты и позже файлы.">
      <input className="mb-6 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 outline-none focus:border-[var(--accent)]" placeholder="Введите запрос..." value={query} onChange={(event) => setQuery(event.target.value)} autoFocus />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="grid content-start gap-3">
          <h2 className="font-semibold">Задачи</h2>
          {filteredTasks.map((task) => <Link key={task.id} href={`/tasks/${task.id}`} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">{task.title}</Link>)}
        </section>
        <section className="grid content-start gap-3">
          <h2 className="font-semibold">Проекты</h2>
          {filteredProjects.map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">{project.name}</Link>)}
        </section>
      </div>
    </Page>
  );
}

