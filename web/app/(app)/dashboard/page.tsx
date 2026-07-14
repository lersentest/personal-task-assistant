'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Page } from '@/components/page';
import { TaskCard } from '@/components/task-card';
import { TaskForm } from '@/components/task-form';
import { api } from '@/lib/api';

export default function DashboardPage() {
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard });

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
    </Page>
  );
}

