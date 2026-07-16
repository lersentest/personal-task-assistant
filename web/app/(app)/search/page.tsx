'use client';

import { useQuery } from '@tanstack/react-query';
import { Archive, CheckSquare, FolderKanban, Search, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DelegatedTaskModalLink } from '@/components/delegated-task-detail-modal';
import { FileModalLink } from '@/components/file-detail-modal';
import { Page } from '@/components/page';
import { ProjectModalLink } from '@/components/project-detail-modal';
import { TaskModalLink } from '@/components/task-detail-modal';
import { EmptyPanel, ErrorState, LoadingState, UiCard } from '@/components/ui-kit';
import { api } from '@/lib/api';

function matches(parts: Array<string | null | undefined>, query: string) {
  const value = parts.filter(Boolean).join(' ').toLowerCase();
  return !query || value.includes(query);
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const normalized = query.trim().toLowerCase();
  const apiQuery = debouncedQuery ? `?q=${encodeURIComponent(debouncedQuery)}` : '';
  const search = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => api.search(apiQuery),
    staleTime: 30_000,
  });

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(normalized);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [normalized]);

  const filteredTasks = useMemo(
    () =>
      (search.data?.tasks ?? []).filter((task) =>
        matches([task.title, task.description, task.project?.name, task.status, task.priority], normalized),
      ),
    [normalized, search.data],
  );
  const filteredDelegatedTasks = useMemo(
    () =>
      (search.data?.delegatedTasks ?? []).filter((task) =>
        matches([task.title, task.description, task.executor.fullName, task.project?.name, task.status], normalized),
      ),
    [normalized, search.data],
  );
  const filteredProjects = useMemo(
    () =>
      (search.data?.projects ?? []).filter((project) =>
        matches([project.name, project.description, project.status], normalized),
      ),
    [normalized, search.data],
  );
  const filteredFiles = useMemo(
    () =>
      (search.data?.files ?? []).filter((file) =>
        matches([file.fileName, file.mimeType, file.task?.title, file.delegatedTask?.title, file.project?.name], normalized),
      ),
    [normalized, search.data],
  );

  const total =
    filteredTasks.length + filteredDelegatedTasks.length + filteredProjects.length + filteredFiles.length;

  return (
    <Page title="Поиск" description="Единый поиск по задачам, делегированным задачам, проектам и файлам.">
      <UiCard className="mb-5 p-3">
        <label className="flex h-12 items-center gap-3 rounded-2xl border border-[var(--focus-border,var(--line))] bg-[var(--focus-surface-secondary,var(--background))] px-4">
          <Search size={18} className="text-[var(--muted)]" />
          <input
            className="min-w-0 flex-1 bg-transparent outline-none"
            placeholder="Введите запрос..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
          <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">
            {total}
          </span>
        </label>
      </UiCard>

      {search.isLoading ? <LoadingState text="Загружаю индекс поиска…" /> : null}
      {search.error ? <ErrorState text={`Поиск недоступен: ${search.error.message}`} /> : null}
      {!search.isLoading && !search.error && total === 0 ? (
        <EmptyPanel title="Ничего не найдено" text="Попробуй другое слово или очисти запрос." />
      ) : null}

      {total ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <SearchSection icon={<CheckSquare size={18} />} title="Личные задачи" count={filteredTasks.length}>
            {filteredTasks.map((task) => (
              <TaskModalLink key={task.id} task={task} className="result-row">
                <span className="font-semibold">{task.title}</span>
                <span className="text-sm text-[var(--muted)]">{task.project?.name ?? 'Без проекта'} · {task.status}</span>
              </TaskModalLink>
            ))}
          </SearchSection>

          <SearchSection icon={<Users size={18} />} title="Делегированные" count={filteredDelegatedTasks.length}>
            {filteredDelegatedTasks.map((task) => (
              <DelegatedTaskModalLink key={task.id} task={task} className="result-row">
                <span className="font-semibold">{task.title}</span>
                <span className="text-sm text-[var(--muted)]">{task.executor.fullName} · {task.status}</span>
              </DelegatedTaskModalLink>
            ))}
          </SearchSection>

          <SearchSection icon={<FolderKanban size={18} />} title="Проекты" count={filteredProjects.length}>
            {filteredProjects.map((project) => (
              <ProjectModalLink key={project.id} project={project} className="result-row">
                <span className="font-semibold">{project.name}</span>
                <span className="text-sm text-[var(--muted)]">{project.description ?? project.status}</span>
              </ProjectModalLink>
            ))}
          </SearchSection>

          <SearchSection icon={<Archive size={18} />} title="Файлы" count={filteredFiles.length}>
            {filteredFiles.map((file) => (
              <FileModalLink key={file.id} attachment={file} className="result-row">
                <span className="font-semibold">{file.fileName}</span>
                <span className="text-sm text-[var(--muted)]">
                  {file.task?.title ?? file.delegatedTask?.title ?? file.project?.name ?? file.mimeType}
                </span>
              </FileModalLink>
            ))}
          </SearchSection>
        </div>
      ) : null}
    </Page>
  );
}

function SearchSection({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <UiCard className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <span className="text-[var(--accent)]">{icon}</span>
          {title}
        </h2>
        <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">{count}</span>
      </div>
      <div className="grid gap-2">
        {count ? children : <p className="text-sm text-[var(--muted)]">Нет результатов.</p>}
      </div>
    </UiCard>
  );
}
