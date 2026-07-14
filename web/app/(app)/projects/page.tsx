'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Page } from '@/components/page';
import { ProjectForm } from '@/components/project-form';
import { api } from '@/lib/api';
import { projectStatusLabel } from '@/lib/labels';

export default function ProjectsPage() {
  const params = useSearchParams();
  const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects });
  const showCreate = params.get('create') === '1';

  return (
    <Page title="Проекты" description="Активные направления и их задачи." actions={<a className="rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm text-[var(--background)]" href="/projects?create=1">Новый проект</a>}>
      {showCreate ? <div className="mb-6"><ProjectForm /></div> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.data?.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm hover:border-[var(--accent)]">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold">{project.name}</h2>
              <span className="rounded-md bg-[var(--accent-soft)] px-2 py-1 text-xs text-[var(--accent)]">{projectStatusLabel[project.status]}</span>
            </div>
            <p className="mt-3 min-h-10 text-sm text-[var(--muted)]">{project.description ?? 'Без описания'}</p>
            <p className="mt-4 text-sm text-[var(--muted)]">Активных задач: {project._count?.tasks ?? 0}</p>
          </Link>
        ))}
      </div>
    </Page>
  );
}

