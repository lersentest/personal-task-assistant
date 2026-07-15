'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, AlertCircle, CalendarDays, CheckCircle2, Clock3, FolderKanban } from 'lucide-react';
import Link from 'next/link';
import { Page } from '@/components/page';
import { TaskCard } from '@/components/task-card';
import { TaskForm } from '@/components/task-form';
import { useUiMode } from '@/components/ui-mode-provider';
import { api } from '@/lib/api';

export default function DashboardPage() {
  const { interfaceMode } = useUiMode();
  const isFocus = interfaceMode === 'focus';
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard });

  if (!isFocus) {
    return (
      <Page title="Доброе утро, Вадим" description="Главное на сегодня и ближайшие дни.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Сегодня', dashboard.data?.summary.today ?? 0, '/today'],
            ['Просрочено', dashboard.data?.summary.overdue ?? 0, '/today'],
            ['На 7 дней', dashboard.data?.summary.upcoming ?? 0, '/tasks?view=UPCOMING'],
            ['Срочные', dashboard.data?.summary.urgent ?? 0, '/tasks?priority=URGENT'],
          ].map(([label, value, href]) => (
            <Link key={label} href={String(href)} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm hover:border-[var(--accent)]">
              <p className="text-sm text-[var(--muted)]">{label}</p>
              <p className="mt-2 text-3xl font-semibold">{value}</p>
            </Link>
          ))}
        </div>
        <div className="mt-6">
          <TaskForm />
        </div>
        <DashboardColumns />
      </Page>
    );
  }

  return (
    <Page title="Доброе утро, Вадим 👋" description="Фокус на сегодняшних задачах, рисках и активных проектах.">
      <section className="mb-6 rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface)] p-5 shadow-sm">
        <p className="mb-3 text-sm font-medium text-[var(--focus-text-secondary)]">Быстрое создание</p>
        <TaskForm compact />
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<CalendarDays size={20} />} label="Сегодня" value={dashboard.data?.summary.today ?? 0} href="/today" />
        <MetricCard icon={<AlertCircle size={20} />} label="Просрочено" value={dashboard.data?.summary.overdue ?? 0} href="/today" danger />
        <MetricCard icon={<Clock3 size={20} />} label="На 7 дней" value={dashboard.data?.summary.upcoming ?? 0} href="/tasks?view=UPCOMING" />
        <MetricCard icon={<CheckCircle2 size={20} />} label="Срочные" value={dashboard.data?.summary.urgent ?? 0} href="/tasks?priority=URGENT" warning />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_1.05fr_0.9fr]">
        <FocusPanel title="Сегодня" badge={dashboard.data?.today.length ?? 0}>
          <div className="grid gap-3">
            {dashboard.data?.today.slice(0, 6).map((task) => <TaskCard key={task.id} task={task} />)}
            {dashboard.data?.today.length === 0 ? <EmptyLine text="На сегодня задач нет." /> : null}
          </div>
        </FocusPanel>

        <FocusPanel title="Требует внимания" badge={dashboard.data?.overdue.length ?? 0}>
          <div className="grid gap-3">
            {dashboard.data?.overdue.slice(0, 6).map((task) => <TaskCard key={task.id} task={task} />)}
            {dashboard.data?.overdue.length === 0 ? <EmptyLine text="Просроченных задач нет. Красота." /> : null}
          </div>
        </FocusPanel>

        <FocusPanel title="Активные проекты" badge={dashboard.data?.activeProjects.length ?? 0}>
          <div className="grid gap-3">
            {dashboard.data?.activeProjects.slice(0, 6).map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface-secondary)] p-4 transition hover:border-[var(--focus-primary)]"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--focus-primary-soft)] font-semibold text-[var(--focus-primary)]">
                    {project.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">{project.name}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--focus-text-secondary)]">
                      {project.description ?? 'Без описания'}
                    </p>
                    <p className="mt-3 text-xs text-[var(--focus-text-muted)]">
                      {project._count?.tasks ?? 0} задач
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </FocusPanel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <FocusPanel title="Недавняя активность">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              'Вы создали задачу',
              'Вы завершили задачу',
              'Вы обновили проект',
              'Вы добавили файл',
            ].map((item) => (
              <div key={item} className="rounded-2xl bg-[var(--focus-surface-secondary)] p-4 text-sm">
                <Activity size={18} className="mb-3 text-[var(--focus-primary)]" />
                <p className="font-medium">{item}</p>
                <p className="mt-1 text-xs text-[var(--focus-text-muted)]">Последние изменения в системе</p>
              </div>
            ))}
          </div>
        </FocusPanel>
        <div className="rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-primary-soft)] p-5 text-[var(--focus-text)]">
          <p className="text-sm font-semibold text-[var(--focus-primary)]">Совет дня</p>
          <p className="mt-3 text-sm text-[var(--focus-text-secondary)]">
            Сначала запланируйте 2–3 важные задачи, а всё остальное оставьте в списке возможных.
          </p>
        </div>
      </div>
    </Page>
  );

  function DashboardColumns() {
    return (
      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <section className="grid gap-3">
          <h2 className="font-semibold">Задачи на сегодня</h2>
          {dashboard.data?.today.map((task) => <TaskCard key={task.id} task={task} />)}
        </section>
        <section className="grid gap-3">
          <h2 className="font-semibold">Просроченные</h2>
          {dashboard.data?.overdue.map((task) => <TaskCard key={task.id} task={task} />)}
        </section>
        <section className="grid gap-3">
          <h2 className="font-semibold">Активные проекты</h2>
          {dashboard.data?.activeProjects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm">
              <p className="font-medium">{project.name}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{project.description ?? 'Без описания'}</p>
            </Link>
          ))}
        </section>
      </div>
    );
  }
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
      className="rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--focus-primary)] hover:shadow-[var(--focus-shadow)]"
    >
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${
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
    <section className="rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface)] p-5 shadow-sm">
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

function EmptyLine({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-[var(--focus-border)] bg-[var(--focus-surface-secondary)] p-4 text-sm text-[var(--focus-text-secondary)]">
      {text}
    </p>
  );
}
