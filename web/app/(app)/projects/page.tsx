'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { CreateEntityModal, CreateEntityState } from '@/components/create-entity-modal';
import { Page } from '@/components/page';
import { useUiMode } from '@/components/ui-mode-provider';
import { api } from '@/lib/api';
import { projectStatusLabel } from '@/lib/labels';

export default function ProjectsPage() {
  const { interfaceMode } = useUiMode();
  const isFocus = interfaceMode === 'focus';
  const params = useSearchParams();
  const router = useRouter();
  const [createModal, setCreateModal] = useState<CreateEntityState | null>(null);
  const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects });
  const urlCreateOpen = params.get('create') === '1';

  return (
    <Page
      title="Проекты"
      description="Активные направления, прогресс и связанные задачи."
      actions={
        <button
          type="button"
          onClick={() => setCreateModal({ entity: 'project' })}
          className="btn-base btn-primary"
        >
          Новый проект
        </button>
      }
    >
      <div className={isFocus ? 'grid gap-4 md:grid-cols-2 2xl:grid-cols-3' : 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'}>
        {projects.data?.map((project) => {
          const count = project._count?.tasks ?? 0;
          const progress = project.status === 'COMPLETED' ? 100 : Math.min(95, Math.max(12, count * 8));
          return (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className={isFocus ? 'interactive-card rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface)] p-5 shadow-sm' : 'interactive-card rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm'}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {isFocus ? (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--focus-primary-soft)] font-semibold text-[var(--focus-primary)]">
                      {project.name.slice(0, 1).toUpperCase()}
                    </span>
                  ) : null}
                  <div>
                    <h2 className="font-semibold">{project.name}</h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">{project.description ?? 'Без описания'}</p>
                  </div>
                </div>
                <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent)]">
                  {projectStatusLabel[project.status]}
                </span>
              </div>
              {isFocus ? (
                <>
                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--focus-surface-secondary)]">
                    <div className="h-full rounded-full bg-[var(--focus-primary)]" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-[var(--focus-text-muted)]">
                    <span>{count} задач</span>
                    <span>{progress}%</span>
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-[var(--muted)]">Активных задач: {count}</p>
              )}
            </Link>
          );
        })}
      </div>
      <CreateEntityModal
        open={Boolean(createModal) || urlCreateOpen}
        state={createModal ?? { entity: 'project' }}
        onClose={() => {
          setCreateModal(null);
          if (urlCreateOpen) router.replace('/projects');
        }}
      />
    </Page>
  );
}
