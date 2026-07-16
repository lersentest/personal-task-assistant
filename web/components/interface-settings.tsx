'use client';

import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Appearance } from '@/lib/ui-preferences';
import { useUiMode } from './ui-mode-provider';

const appearanceOptions: Array<{
  value: Appearance;
  title: string;
  description: string;
}> = [
  { value: 'light', title: 'Светлая', description: 'Всегда светлая тема.' },
  { value: 'dark', title: 'Тёмная', description: 'Всегда тёмная тема.' },
];

export function InterfaceSettings() {
  const { appearance, resolvedAppearance, setAppearance } = useUiMode();

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Тема</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Сейчас применяется: {resolvedAppearance === 'dark' ? 'тёмная' : 'светлая'}.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {appearanceOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setAppearance(option.value)}
              className={`rounded-xl border p-4 text-left transition ${
                appearance === option.value
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                  : 'border-[var(--line)] hover:bg-[var(--background)]'
              }`}
            >
              <span className="font-semibold">{option.title}</span>
              <span className="mt-1 block text-sm text-[var(--muted)]">
                {option.description}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">UI Kit</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Служебная страница с эталонными элементами дизайн-системы.
            </p>
          </div>
          <Link href="/ui-kit" className="btn-base btn-secondary">
            Открыть
            <ExternalLink size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
