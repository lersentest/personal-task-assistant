'use client';

import { Appearance, InterfaceMode } from '@/lib/ui-preferences';
import { useUiMode } from './ui-mode-provider';

const interfaceOptions: Array<{
  value: InterfaceMode;
  title: string;
  description: string;
}> = [
  {
    value: 'focus',
    title: 'Focus',
    description: 'Современный интерфейс с новым layout, sidebar и topbar.',
  },
  {
    value: 'classic',
    title: 'Classic',
    description: 'Исходный интерфейс без визуальных изменений.',
  },
];

const appearanceOptions: Array<{
  value: Appearance;
  title: string;
  description: string;
}> = [
  { value: 'light', title: 'Светлая', description: 'Всегда светлая тема.' },
  { value: 'dark', title: 'Тёмная', description: 'Всегда тёмная тема.' },
  { value: 'system', title: 'Системная', description: 'Следовать настройке устройства.' },
];

export function InterfaceSettings() {
  const {
    interfaceMode,
    appearance,
    resolvedAppearance,
    setInterfaceMode,
    setAppearance,
  } = useUiMode();

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Интерфейс</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Focus и Classic переключают структуру интерфейса. Тема настраивается отдельно.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {interfaceOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setInterfaceMode(option.value)}
              className={`rounded-xl border p-4 text-left transition ${
                interfaceMode === option.value
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
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Тема</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Сейчас применяется: {resolvedAppearance === 'dark' ? 'тёмная' : 'светлая'}.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
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
    </div>
  );
}

