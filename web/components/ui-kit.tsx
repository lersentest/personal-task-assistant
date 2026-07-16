'use client';

import { AlertCircle, CheckCircle2, Circle, Clock3, Loader2, X } from 'lucide-react';
import { useEffect } from 'react';
import { priorityLabel, statusLabel } from '@/lib/labels';
import type { TaskPriority, TaskStatus } from '@/lib/types';

export function UiCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border border-[var(--focus-border,var(--line))] bg-[var(--focus-surface,var(--panel))] shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export function SectionHeader({
  title,
  badge,
  action,
}: {
  title: string;
  badge?: number | string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="truncate text-lg font-semibold tracking-[-0.02em]">{title}</h2>
        {badge !== undefined ? (
          <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">
            {badge}
          </span>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const tone =
    status === 'COMPLETED'
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-200'
      : status === 'IN_PROGRESS'
        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/35 dark:text-blue-200'
        : status === 'CANCELLED'
          ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{statusLabel[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const tone =
    priority === 'URGENT'
      ? 'bg-red-50 text-red-700 dark:bg-red-950/35 dark:text-red-200'
      : priority === 'HIGH'
        ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/35 dark:text-orange-200'
        : priority === 'LOW'
          ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          : 'bg-blue-50 text-blue-700 dark:bg-blue-950/35 dark:text-blue-200';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {priorityLabel[priority]}
    </span>
  );
}

export function LoadingState({ text = 'Загружаю…' }: { text?: string }) {
  return (
    <div className="grid min-h-32 place-items-center rounded-3xl border border-dashed border-[var(--focus-border,var(--line))] bg-[var(--focus-surface,var(--panel))] p-8 text-sm text-[var(--muted)]">
      <span className="inline-flex items-center gap-2">
        <Loader2 size={17} className="animate-spin" />
        {text}
      </span>
    </div>
  );
}

export function ErrorState({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
      <span className="inline-flex items-center gap-2">
        <AlertCircle size={17} />
        {text}
      </span>
    </div>
  );
}

export function EmptyPanel({ title, text }: { title: string; text?: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--focus-border,var(--line))] bg-[var(--focus-surface,var(--panel))] p-8 text-center">
      <Circle className="mx-auto mb-3 text-[var(--muted)]" size={22} />
      <p className="font-semibold">{title}</p>
      {text ? <p className="mt-1 text-sm text-[var(--muted)]">{text}</p> : null}
    </div>
  );
}

export function EntityDrawer({
  open,
  onClose,
  eyebrow,
  title,
  subtitle,
  actions,
  children,
  width = 'max-w-5xl',
}: {
  open: boolean;
  onClose: () => void;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[10000] flex items-stretch justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={onClose}
    >
      <aside
        className={`flex h-full w-full ${width} flex-col overflow-hidden border border-[var(--focus-border,var(--line))] bg-[var(--focus-surface,var(--panel))] text-[var(--foreground)] shadow-2xl transition sm:h-auto sm:max-h-[92vh] sm:rounded-3xl`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--focus-border-soft,var(--line))] p-4 sm:p-6">
          <div className="min-w-0">
            {eyebrow ? <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">{eyebrow}</div> : null}
            <h2 className="truncate text-xl font-semibold tracking-[-0.03em] text-[var(--foreground)] sm:text-2xl">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <button type="button" onClick={onClose} className="btn-base btn-ghost h-10 w-10 p-0" aria-label="Закрыть">
              <X size={20} />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
      </aside>
    </div>
  );
}

export function InlineSuccess({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
      <span className="inline-flex items-center gap-2">
        <CheckCircle2 size={16} />
        {text}
      </span>
    </p>
  );
}

export function MetricStrip({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode; icon?: React.ReactNode; tone?: 'blue' | 'green' | 'red' | 'orange' | 'gray' }>;
}) {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/35 dark:text-blue-200',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-200',
    red: 'bg-red-50 text-red-700 dark:bg-red-950/35 dark:text-red-200',
    orange: 'bg-orange-50 text-orange-700 dark:bg-orange-950/35 dark:text-orange-200',
    gray: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="rounded-3xl border border-[var(--focus-border,var(--line))] bg-[var(--focus-surface,var(--panel))] p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${toneClass[item.tone ?? 'blue']}`}>
              {item.icon ?? <Clock3 size={18} />}
            </span>
            <span>
              <span className="block text-xs text-[var(--muted)]">{item.label}</span>
              <span className="mt-1 block text-lg font-semibold tracking-[-0.02em]">{item.value}</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
