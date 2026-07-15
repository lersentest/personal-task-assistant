'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Lightbulb,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { Page } from '@/components/page';
import { TaskCard } from '@/components/task-card';
import { TaskForm } from '@/components/task-form';
import { useUiMode } from '@/components/ui-mode-provider';
import { api } from '@/lib/api';
import { ActivityEvent, Project } from '@/lib/types';

export default function DashboardPage() {
  const { interfaceMode } = useUiMode();
  const isFocus = interfaceMode === 'focus';
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard });

  if (!isFocus) {
    return (
      <Page title="Доброе утро, Вадим" description="Главное на сегодня и ближайшие дни.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={<CalendarDays size={20} />} label="Сегодня" value={dashboard.data?.summary.today ?? 0} href="/today" />
          <MetricCard icon={<AlertCircle size={20} />} label="Просрочено" value={dashboard.data?.summary.overdue ?? 0} href="/today" danger />
          <MetricCard icon={<Clock3 size={20} />} label="На 7 дней" value={dashboard.data?.summary.upcoming ?? 0} href="/tasks?view=UPCOMING" />
          <MetricCard icon={<CheckCircle2 size={20} />} label="Срочные" value={dashboard.data?.summary.urgent ?? 0} href="/tasks?priority=URGENT" warning />
        </div>
        <div className="mt-6">
          <TaskForm />
        </div>
      </Page>
    );
  }

  const attention = dashboard.data?.attention ?? dashboard.data?.overdue ?? [];
  const activity = dashboard.data?.recentActivity ?? [];
  const projects = dashboard.data?.activeProjects ?? [];

  return (
    <Page title="Доброе утро, Вадим 👋" description="Фокус на сегодня: задачи, риски, проекты и последние изменения.">
      <section className="mb-5 rounded-3xl border border-[var(--focus-border)] bg-[var(--focus-surface)] p-4 shadow-sm">
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--focus-border-soft)] bg-[var(--focus-surface-secondary)] px-4 py-3">
          <Plus size={18} className="text-[var(--focus-primary)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--focus-text)]">Что нужно сделать?</p>
            <p className="text-xs text-[var(--focus-text-muted)]">Быстро добавь задачу, звонок, встречу, идею или заметку.</p>
          </div>
        </div>
        <div className="mt-4">
          <TaskForm compact />
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<CalendarDays size={20} />} label="Сегодня" value={dashboard.data?.summary.today ?? 0} href="/today" />
        <MetricCard icon={<AlertCircle size={20} />} label="Просрочено" value={dashboard.data?.summary.overdue ?? 0} href="/today" danger />
        <MetricCard icon={<Clock3 size={20} />} label="На 7 дней" value={dashboard.data?.summary.upcoming ?? 0} href="/tasks?view=UPCOMING" />
        <MetricCard icon={<CheckCircle2 size={20} />} label="Срочные" value={dashboard.data?.summary.urgent ?? 0} href="/tasks?priority=URGENT" warning />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr_0.95fr]">
        <FocusPanel title="Сегодня" badge={dashboard.data?.today.length ?? 0}>
          <div className="grid gap-2">
            {dashboard.data?.today.slice(0, 7).map((task) => <TaskCard key={task.id} task={task} />)}
            {dashboard.data?.today.length === 0 ? <EmptyLine text="На сегодня задач нет." /> : null}
          </div>
        </FocusPanel>

        <FocusPanel title="Требует внимания" badge={attention.length}>
          <div className="grid gap-2">
            {attention.slice(0, 7).map((task) => <TaskCard key={task.id} task={task} />)}
            {attention.length === 0 ? <EmptyLine text="Просроченных и важных задач нет." /> : null}
          </div>
        </FocusPanel>

        <FocusPanel title="Активные проекты" badge={projects.length}>
          <div className="grid gap-3">
            {projects.slice(0, 6).map((project, index) => (
              <ProjectProgressCard key={project.id} project={project} index={index} />
            ))}
            {projects.length === 0 ? <EmptyLine text="Активных проектов пока нет." /> : null}
          </div>
        </FocusPanel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_340px]">
        <FocusPanel title="Недавняя активность" badge={activity.length}>
          <div className="grid gap-3 md:grid-cols-4">
            {activity.slice(0, 4).map((item) => (
              <ActivityCard key={item.id} item={item} />
            ))}
            {activity.length === 0 ? <EmptyLine text="Активность появится после новых изменений." /> : null}
          </div>
        </FocusPanel>
        <div className="rounded-3xl border border-[var(--focus-border)] bg-[var(--focus-primary-soft)] p-5 text-[var(--focus-text)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--focus-primary)]">
            <Lightbulb size={18} />
            Совет дня
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--focus-text-secondary)]">
            Сначала запланируй 2–3 самые важные задачи в шкалу дня. Остальное оставь в возможных задачах — так день не расползётся.
          </p>
        </div>
      </div>
    </Page>
  );
}

function MetricCard({
  icon,
  label,
  value,
  href,
  danger,
  warning,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  href: string;
  danger?: boolean;
  warning?: boolean;
}) {
  return (
    <Link
      href={href}
      className="rounded-3xl border border-[var(--focus-border)] bg-[var(--focus-surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--focus-primary)] hover:shadow-[var(--focus-shadow)]"
    >
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ${
        danger ? 'bg-red-50 text-red-600 dark:bg-red-950/40' : warning ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/40' : 'bg-[var(--focus-primary-soft)] text-[var(--focus-primary)]'
      }`}>
        {icon}
      </div>
      <p className="text-sm text-[var(--focus-text-secondary)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{value}</p>
    </Link>
  );
}

function FocusPanel({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[var(--focus-border)] bg-[var(--focus-surface)] p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-[-0.02em]">{title}</h2>
        {typeof badge === 'number' ? (
          <span className="rounded-full bg-[var(--focus-primary-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--focus-primary)]">
            {badge}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ProjectProgressCard({ project, index }: { project: Project; index: number }) {
  const total = project._count?.tasks ?? 0;
  const progress = Math.min(92, Math.max(22, 38 + index * 9 + total * 3));
  return (
    <Link
      href={`/projects/${project.id}`}
      className="rounded-2xl border border-[var(--focus-border-soft)] bg-[var(--focus-surface-secondary)] p-4 transition hover:border-[var(--focus-primary)]"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--focus-primary-soft)] font-semibold text-[var(--focus-primary)]">
          {project.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{project.name}</p>
          <p className="mt-1 line-clamp-2 text-sm text-[var(--focus-text-secondary)]">
            {project.description ?? 'Без описания'}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--focus-border)]">
            <div className="h-full rounded-full bg-[var(--focus-primary)]" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-[var(--focus-text-muted)]">
            {total} активных задач · {progress}%
          </p>
        </div>
        <FolderKanban size={17} className="text-[var(--focus-text-muted)]" />
      </div>
    </Link>
  );
}

function ActivityCard({ item }: { item: ActivityEvent }) {
  return (
    <div className="rounded-2xl bg-[var(--focus-surface-secondary)] p-4 text-sm">
      <Activity size={18} className="mb-3 text-[var(--focus-primary)]" />
      <p className="font-medium">{activityLabel(item.type)}</p>
      <p className="mt-1 line-clamp-1 text-xs text-[var(--focus-text-muted)]">{item.title}</p>
    </div>
  );
}

function activityLabel(type: ActivityEvent['type']) {
  const labels: Record<ActivityEvent['type'], string> = {
    TASK_CREATED: 'Создана задача',
    TASK_UPDATED: 'Обновлена задача',
    TASK_COMPLETED: 'Завершена задача',
    TASK_DELETED: 'Удалена задача',
    PROJECT_CREATED: 'Создан проект',
    PROJECT_UPDATED: 'Обновлён проект',
    FILE_ADDED: 'Добавлен файл',
  };
  return labels[type];
}

function EmptyLine({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-[var(--focus-border)] bg-[var(--focus-surface-secondary)] p-4 text-sm text-[var(--focus-text-secondary)]">
      {text}
    </p>
  );
}
