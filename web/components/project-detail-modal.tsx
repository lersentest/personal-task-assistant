'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FolderKanban, Pencil, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { projectStatusLabel } from '@/lib/labels';
import { Project } from '@/lib/types';
import { AttachmentPanel } from './attachment-panel';
import { ProjectForm } from './project-form';
import { TaskCard } from './task-card';
import { EntityDrawer } from './ui-kit';

export function ProjectModalLink({
  project,
  projectId,
  children,
  className,
  title,
}: {
  project?: Project;
  projectId?: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = project?.id ?? projectId;

  if (!id) return <>{children}</>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        title={title ?? 'Открыть проект'}
      >
        {children}
      </button>
      <ProjectDetailsModal
        projectId={id}
        initialProject={project}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export function ProjectDetailsModal({
  projectId,
  initialProject,
  open,
  onClose,
}: {
  projectId: string;
  initialProject?: Project;
  open: boolean;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const project = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.project(projectId),
    enabled: open,
    initialData: initialProject,
  });
  const tasks = useQuery({
    queryKey: ['tasks', 'project', projectId],
    queryFn: () => api.tasks(`?projectId=${projectId}`),
    enabled: open,
  });
  const delegatedTasks = useQuery({
    queryKey: ['delegated-tasks', 'project', projectId],
    queryFn: () => api.delegatedTasks(`?projectId=${projectId}`),
    enabled: open,
  });

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

  useEffect(() => {
    if (!open) setEditing(false);
  }, [open]);

  if (!open) return null;

  const data = project.data;
  const taskCount = data?._count?.tasks ?? tasks.data?.length ?? 0;

  return (
    <EntityDrawer
      open={open}
      onClose={onClose}
      width="max-w-6xl"
      eyebrow={
        <>
              <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 font-medium text-[var(--accent)]">
                Проект
              </span>
              {data ? <span>{projectStatusLabel[data.status]}</span> : null}
        </>
      }
      title={data?.name ?? 'Загружаю проект...'}
      subtitle="Просмотр проекта, задач, файлов и быстрых действий."
      actions={
            <Link
              href={`/projects/${projectId}`}
              className="btn-base btn-secondary"
              onClick={onClose}
            >
              <ExternalLink size={16} />
              Страница
            </Link>
      }
    >
          {project.error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Не удалось загрузить проект: {project.error.message}
            </div>
          ) : null}

          {data ? (
            <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
              <div className="grid content-start gap-5">
                {editing ? (
                  <ProjectForm project={data} onDone={() => setEditing(false)} />
                ) : (
                  <section className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-5">
                    <p className="whitespace-pre-wrap text-[var(--muted)]">
                      {data.description ?? 'Описание не указано.'}
                    </p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-[var(--panel)] p-3">
                        <p className="text-xs text-[var(--muted)]">Статус</p>
                        <p className="mt-1 font-medium">{projectStatusLabel[data.status]}</p>
                      </div>
                      <div className="rounded-xl bg-[var(--panel)] p-3">
                        <p className="text-xs text-[var(--muted)]">Задач</p>
                        <p className="mt-1 font-medium">{taskCount}</p>
                      </div>
                      <div className="rounded-xl bg-[var(--panel)] p-3">
                        <p className="text-xs text-[var(--muted)]">Создан</p>
                        <p className="mt-1 font-medium">{new Date(data.createdAt).toLocaleDateString('ru-RU')}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="btn-base btn-primary mt-4"
                    >
                      <Pencil size={16} />
                      Редактировать
                    </button>
                  </section>
                )}

                <section className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-5">
                  <h3 className="mb-3 text-lg font-semibold">Задачи проекта</h3>
                  <div className="grid gap-3">
                    {tasks.data?.length ? (
                      tasks.data.map((task) => <TaskCard key={task.id} task={task} />)
                    ) : (
                      <p className="text-sm text-[var(--muted)]">Задач по проекту пока нет.</p>
                    )}
                  </div>
                </section>
              </div>

              <aside className="grid content-start gap-5">
                <section className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <FolderKanban size={18} />
                    <h3 className="font-semibold">Делегированные</h3>
                  </div>
                  <div className="grid gap-2">
                    {delegatedTasks.data?.length ? (
                      delegatedTasks.data.map((task) => (
                        <div key={task.id} className="rounded-xl bg-[var(--panel)] p-3 text-sm">
                          <p className="font-medium">{task.title}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {task.executor.fullName} · {task.status}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--muted)]">
                        Делегированных задач пока нет.
                      </p>
                    )}
                  </div>
                </section>
                <AttachmentPanel projectId={projectId} title="Файлы проекта" />
              </aside>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Загружаю проект...</p>
          )}
    </EntityDrawer>
  );
}
