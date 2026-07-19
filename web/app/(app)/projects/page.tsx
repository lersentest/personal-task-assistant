'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { CreateEntityModal, CreateEntityState } from '@/components/create-entity-modal';
import { Page } from '@/components/page';
import { ProjectModalLink } from '@/components/project-detail-modal';
import { EmptyPanel, ErrorState, LoadingState } from '@/components/ui-kit';
import { useUiMode } from '@/components/ui-mode-provider';
import { api } from '@/lib/api';
import { projectStatusLabel } from '@/lib/labels';
import { Project } from '@/lib/types';

const UNASSIGNED_PROJECT_NAME = 'Без проекта';
const UNASSIGNED_PROJECT_DESCRIPTION = 'Все задачи, которые создаются без выбора проекта.';

async function loadProjectsWithUnassignedProject() {
  const projects = await api.projects();
  if (projects.some((project) => project.name === UNASSIGNED_PROJECT_NAME)) {
    return projects;
  }

  try {
    const created = await api.createProject({
      name: UNASSIGNED_PROJECT_NAME,
      description: UNASSIGNED_PROJECT_DESCRIPTION,
    });
    return [created, ...projects];
  } catch {
    return projects;
  }
}

export default function ProjectsPage() {
  const { interfaceMode } = useUiMode();
  const isFocus = interfaceMode === 'focus';
  const params = useSearchParams();
  const router = useRouter();
  const [createModal, setCreateModal] = useState<CreateEntityState | null>(null);
  const projects = useQuery({ queryKey: ['projects'], queryFn: loadProjectsWithUnassignedProject });
  const urlCreateOpen = params.get('create') === '1';
  const sortedProjects = useMemo(() => {
    const data = projects.data ?? [];
    return [...data].sort((a, b) => {
      if (a.name === UNASSIGNED_PROJECT_NAME) return -1;
      if (b.name === UNASSIGNED_PROJECT_NAME) return 1;
      return 0;
    });
  }, [projects.data]);
  const hasUnassignedProject = sortedProjects.some((project) => project.name === UNASSIGNED_PROJECT_NAME);

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
      {projects.isLoading ? <LoadingState text="Загружаю проекты…" /> : null}
      {projects.error ? <ErrorState text={`Не удалось загрузить проекты: ${projects.error.message}`} /> : null}
      {!projects.isLoading && !projects.error && !projects.data?.length ? (
        <EmptyPanel title="Проектов пока нет" text="Создай первый проект кнопкой «Новый проект»." />
      ) : null}
      <div className={isFocus ? 'grid gap-4 md:grid-cols-2 2xl:grid-cols-3' : 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'}>
        {!projects.isLoading && !hasUnassignedProject ? (
          <UnassignedFallbackCard isFocus={isFocus} />
        ) : null}
        {sortedProjects.map((project) => {
          return (
            <ProjectModalLink
              key={project.id}
              project={project}
              className={isFocus ? 'interactive-card flex min-h-[230px] flex-col rounded-3xl border border-[var(--focus-border)] bg-[var(--focus-surface)] p-5 text-left shadow-sm' : 'interactive-card flex min-h-[220px] flex-col rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5 text-left shadow-sm'}
            >
              <ProjectCardContent project={project} isFocus={isFocus} />
            </ProjectModalLink>
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

function ProjectCardContent({
  project,
  isFocus,
}: {
  project: Project;
  isFocus: boolean;
}) {
  const isUnassigned = project.name === UNASSIGNED_PROJECT_NAME;
  const activeCount = project.taskStats?.active ?? project._count?.tasks ?? 0;
  const completedCount = project.taskStats?.completed ?? 0;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {isFocus ? (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--focus-primary-soft)] font-semibold text-[var(--focus-primary)]">
              {project.name.slice(0, 1).toUpperCase()}
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="font-semibold">{project.name}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
              {isUnassigned
                ? UNASSIGNED_PROJECT_DESCRIPTION
                : project.description ?? 'Без описания'}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent)]">
          {projectStatusLabel[project.status]}
        </span>
      </div>
      {isFocus ? (
        <div className="mt-auto pt-5">
          <ProjectStats activeCount={activeCount} completedCount={completedCount} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Текущие: {activeCount} · Выполнено: {completedCount}
        </p>
      )}
    </>
  );
}

function ProjectStats({
  activeCount,
  completedCount,
}: {
  activeCount: number;
  completedCount: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl bg-[var(--focus-surface-secondary)] px-3 py-3">
        <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--focus-text-muted)]">Текущие</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--focus-text)]">{activeCount}</p>
      </div>
      <div className="rounded-2xl bg-[rgba(34,197,94,0.10)] px-3 py-3">
        <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--focus-text-muted)]">Выполнено</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--focus-success)]">{completedCount}</p>
      </div>
    </div>
  );
}

function UnassignedFallbackCard({ isFocus }: { isFocus: boolean }) {
  return (
    <Link
      href="/unassigned"
      className={
        isFocus
          ? 'interactive-card flex min-h-[230px] flex-col rounded-3xl border border-dashed border-[var(--focus-primary)] bg-[var(--focus-primary-soft)] p-5 text-left shadow-sm'
          : 'interactive-card flex min-h-[220px] flex-col rounded-lg border border-dashed border-[var(--accent)] bg-[var(--accent-soft)] p-5 text-left shadow-sm'
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {isFocus ? (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--focus-surface)] font-semibold text-[var(--focus-primary)]">
              Б
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="font-semibold">{UNASSIGNED_PROJECT_NAME}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
              {UNASSIGNED_PROJECT_DESCRIPTION}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent)]">
          Системный
        </span>
      </div>
      {isFocus ? (
        <div className="mt-auto pt-5">
          <ProjectStats activeCount={0} completedCount={0} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--muted)]">Текущие: 0 · Выполнено: 0</p>
      )}
    </Link>
  );
}
