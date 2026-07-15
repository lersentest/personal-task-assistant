'use client';

import {
  Archive,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Command,
  FolderKanban,
  Home,
  LogOut,
  Menu,
  Mic,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Trash2,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useUiMode } from '../ui-mode-provider';
import { VoiceCommandButton } from '../voice-command-button';

const sections = [
  {
    title: 'План',
    items: [
      { href: '/my-day', label: 'Мой день', icon: Sun },
      { href: '/dashboard', label: 'Обзор', icon: Home },
      { href: '/calendar', label: 'Календарь', icon: CalendarDays },
    ],
  },
  {
    title: 'Работа',
    items: [
      { href: '/tasks', label: 'Задачи', icon: CheckSquare },
      { href: '/projects', label: 'Проекты', icon: FolderKanban },
    ],
  },
  {
    title: 'Библиотека',
    items: [
      { href: '/search', label: 'Поиск', icon: Search },
      { href: '/files', label: 'Файлы', icon: Archive },
    ],
  },
  {
    title: 'Система',
    items: [
      { href: '/unassigned', label: 'Без проекта', icon: Menu },
      { href: '/trash', label: 'Корзина', icon: Trash2 },
    ],
  },
];

export function FocusShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { appearance, setAppearance } = useUiMode();
  const [createOpen, setCreateOpen] = useState(false);

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  function cycleAppearance() {
    setAppearance(
      appearance === 'light' ? 'dark' : appearance === 'dark' ? 'system' : 'light',
    );
  }

  return (
    <div className="min-h-screen bg-[var(--focus-bg)] text-[var(--focus-text)] lg:grid lg:grid-cols-[292px_1fr]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[292px] border-r border-[var(--focus-border)] bg-[var(--focus-surface)]/95 px-4 py-5 shadow-[var(--focus-shadow)] backdrop-blur lg:flex lg:flex-col">
        <Link href="/my-day" className="mb-7 flex items-center gap-3 px-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--focus-primary)] text-white shadow-sm">
            <CheckSquare size={18} />
          </span>
          <span className="text-lg font-semibold tracking-tight">Personal Tasks</span>
        </Link>

        <div className="relative mb-7">
          <button
            onClick={() => setCreateOpen((value) => !value)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--focus-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--focus-primary-hover)]"
          >
            <Plus size={18} />
            Новая задача
            <ChevronDown size={16} className="ml-auto" />
          </button>
          {createOpen ? (
            <div className="absolute left-0 right-0 top-14 z-40 grid gap-1 rounded-xl border border-[var(--focus-border)] bg-[var(--focus-surface)] p-2 text-sm shadow-[var(--focus-shadow)]">
              <Link href="/tasks?create=1" className="rounded-lg px-3 py-2 hover:bg-[var(--focus-primary-soft)]">
                Создать задачу
              </Link>
              <Link href="/projects?create=1" className="rounded-lg px-3 py-2 hover:bg-[var(--focus-primary-soft)]">
                Создать проект
              </Link>
            </div>
          ) : null}
        </div>

        <nav className="grid gap-6">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--focus-text-muted)]">
                {section.title}
              </p>
              <div className="grid gap-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        active
                          ? 'bg-[var(--focus-primary-soft)] text-[var(--focus-primary)]'
                          : 'text-[var(--focus-text-secondary)] hover:bg-[var(--focus-surface-secondary)] hover:text-[var(--focus-text)]'
                      }`}
                    >
                      <Icon size={18} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto grid gap-1 border-t border-[var(--focus-border-soft)] pt-4 text-sm text-[var(--focus-text-secondary)]">
          <button
            onClick={cycleAppearance}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--focus-surface-secondary)]"
          >
            {appearance === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
            {appearance === 'system' ? 'Системная тема' : appearance === 'dark' ? 'Тёмная тема' : 'Светлая тема'}
          </button>
          <Link href="/settings" className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--focus-surface-secondary)]">
            <Settings size={18} /> Настройки
          </Link>
          <Link href="/profile" className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--focus-surface-secondary)]">
            <User size={18} /> Профиль
          </Link>
          <button onClick={logout} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--focus-surface-secondary)]">
            <LogOut size={18} /> Выход
          </button>
        </div>
      </aside>

      <div className="lg:col-start-2">
        <header className="sticky top-0 z-20 border-b border-[var(--focus-border-soft)] bg-[var(--focus-bg)]/90 px-4 py-3 backdrop-blur lg:px-8">
          <div className="mx-auto flex max-w-[1600px] items-center gap-3">
            <button className="rounded-xl border border-[var(--focus-border)] bg-[var(--focus-surface)] p-2 text-[var(--focus-text-secondary)] lg:hidden">
              <Menu size={20} />
            </button>
            <button className="hidden h-11 min-w-0 flex-1 items-center gap-3 rounded-xl border border-[var(--focus-border)] bg-[var(--focus-surface)] px-4 text-sm text-[var(--focus-text-muted)] shadow-sm md:flex md:max-w-[620px]">
              <Search size={18} />
              Поиск по задачам, проектам, тегам...
              <span className="ml-auto inline-flex items-center gap-1 rounded-lg bg-[var(--focus-surface-secondary)] px-2 py-1 text-xs text-[var(--focus-text-muted)]">
                <Command size={13} /> K
              </span>
            </button>
            <div className="ml-auto flex items-center gap-2">
              <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--focus-border)] bg-[var(--focus-surface)] text-[var(--focus-text-secondary)] shadow-sm">
                <Mic size={18} />
              </button>
              <Link
                href="/tasks?create=1"
                className="hidden h-11 items-center gap-2 rounded-xl border border-[var(--focus-border)] bg-[var(--focus-surface)] px-4 text-sm font-semibold shadow-sm transition hover:bg-[var(--focus-surface-secondary)] sm:flex"
              >
                <Plus size={18} />
                Создать
              </Link>
              <Link
                href="/profile"
                className="flex h-11 items-center gap-3 rounded-xl px-2 text-sm hover:bg-[var(--focus-surface-secondary)]"
              >
                <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[var(--focus-primary-soft)] text-sm font-semibold text-[var(--focus-primary)]">
                  В
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--focus-surface)] bg-[var(--focus-success)]" />
                </span>
                <span className="hidden text-left md:block">
                  <span className="block font-semibold leading-4">Вадим</span>
                  <span className="text-xs text-[var(--focus-text-muted)]">Фокус</span>
                </span>
                <ChevronDown size={16} className="hidden text-[var(--focus-text-muted)] md:block" />
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 pb-24 lg:px-8">
          {children}
        </main>
      </div>

      <VoiceCommandButton />

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[var(--focus-border)] bg-[var(--focus-surface)] px-1 py-2 shadow-[var(--focus-shadow)] lg:hidden">
        {[
          { href: '/my-day', label: 'Мой день', icon: Sun },
          { href: '/calendar', label: 'Календарь', icon: CalendarDays },
          { href: '/tasks?create=1', label: 'Создать', icon: Plus },
          { href: '/tasks', label: 'Задачи', icon: CheckSquare },
          { href: '/dashboard', label: 'Ещё', icon: Menu },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 rounded-lg px-1 py-1 text-[11px] text-[var(--focus-text-secondary)]">
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

