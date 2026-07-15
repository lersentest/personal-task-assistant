'use client';

import { useUiMode } from './ui-mode-provider';

export function Page({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { interfaceMode } = useUiMode();
  if (interfaceMode === 'focus') {
    return (
      <section className="focus-page">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--focus-text-muted)]">
              Personal Tasks
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[var(--focus-text)]">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 max-w-2xl text-sm text-[var(--focus-text-secondary)]">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </header>
        {children}
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="mt-1 text-sm text-[var(--muted)]">{description}</p> : null}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--panel)] p-8 text-center text-sm text-[var(--muted)]">
      {text}
    </div>
  );
}
