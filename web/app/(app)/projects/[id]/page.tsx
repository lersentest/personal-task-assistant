'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Page } from '@/components/page';
import { ProjectForm } from '@/components/project-form';
import { TaskCard } from '@/components/task-card';
import { TaskForm } from '@/components/task-form';
import { api } from '@/lib/api';
import { projectStatusLabel } from '@/lib/labels';

export default function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [editing, setEditing] = useState(false);
  const project = useQuery({ queryKey: ['project', id], queryFn: () => api.project(id) });
  const tasks = useQuery({ queryKey: ['tasks', 'project', id], queryFn: () => api.tasks(`?projectId=${id}`) });

  return (
    <Page title={project.data?.name ?? 'Проект'} description={project.data ? projectStatusLabel[project.data.status] : undefined}>
      {project.data && editing ? <ProjectForm project={project.data} onDone={() => setEditing(false)} /> : null}
      {project.data && !editing ? (
        <div className="mb-6 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
          <p className="text-[var(--muted)]">{project.data.description ?? 'Описание не указано.'}</p>
          <div className="mt-4 flex gap-2">
            <button onClick={() => setEditing(true)} className="rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm text-[var(--background)]">Редактировать</button>
          </div>
        </div>
      ) : null}
      <div className="mb-6">
        <TaskForm projectId={id} />
      </div>
      <div className="grid gap-3">
        {tasks.data?.map((task) => <TaskCard key={task.id} task={task} />)}
      </div>
    </Page>
  );
}

