'use client';

import {
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FolderKanban,
  Home,
  LogOut,
  Menu,
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
import { VoiceCommandButton } from './voice-command-button';

const nav = [
  { href: '/my-day', label: 'Мой день', icon: ClipboardList },
  { href: '/dashboard', label: 'Обзор', icon: Home },
  { href: '/today', label: 'Сегодня', icon: CheckSquare },
  { href: '/calendar', label: 'Календарь', icon: CalendarDays },
  { href: '/tasks', label: 'Задачи', icon: CheckSquare },
  { href: '/projects', label: 'Проекты', icon: FolderKanban },
  { href: '/unassigned', label: 'Без проекта', icon: Menu },
  { href: '/search', label: 'Поиск', icon: Search },
  { href: '/files', label: 'Файлы', icon: FolderKanban },
  { href: '/trash', label: 'Корзина', icon: Trash2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  function toggleTheme() {
    const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', next === 'dark');
    localStorage.setItem('theme', next);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[260px] border-r border-[var(--line)] bg-[var(--panel)] px-4 py-5 lg:flex lg:flex-col">
        <Link href="/my-day" className="mb-6 text-lg font-semibold">
          Personal Tasks
        </Link>
        <button
          className="mb-4 flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--foreground)] px-4 text-sm font-medium text-[var(--background)]"
          onClick={() => setCreateOpen((value) => !value)}
        >
          <Plus size={18} /> Создать
        </button>
        {createOpen ? (
          <div className="mb-4 grid gap-2 rounded-lg border border-[var(--line)] bg-[var(--background)] p-2 text-sm">
            <Link href="/tasks?create=1" className="rounded-md px-3 py-2 hover:bg-[var(--panel)]">Новая задача</Link>
            <Link href="/projects?create=1" className="rounded-md px-3 py-2 hover:bg-[var(--panel)]">Новый проект</Link>
          </div>
        ) : null}
        <nav className="grid gap-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                  active ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--muted)] hover:bg-[var(--background)]'
                }`}
              >
                <Icon size={17} /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto grid gap-1 text-sm text-[var(--muted)]">
          <button onClick={toggleTheme} className="flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-[var(--background)]">
            <Sun size={17} /> <Moon size={17} /> Тема
          </button>
          <Link href="/settings" className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-[var(--background)]">
            <Settings size={17} /> Настройки
          </Link>
          <Link href="/profile" className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-[var(--background)]">
            <User size={17} /> Профиль
          </Link>
          <button onClick={logout} className="flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-[var(--background)]">
            <LogOut size={17} /> Выход
          </button>
        </div>
      </aside>
      <main className="pb-20 lg:col-start-2 lg:pb-0">
        {children}
      </main>
      <VoiceCommandButton />
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[var(--line)] bg-[var(--panel)] px-1 py-2 lg:hidden">
        {[
          { href: '/my-day', label: 'Мой день', icon: ClipboardList },
          { href: '/calendar', label: 'Календарь', icon: CalendarDays },
          { href: '/tasks?create=1', label: 'Создать', icon: Plus },
          { href: '/projects', label: 'Проекты', icon: FolderKanban },
          { href: '/dashboard', label: 'Ещё', icon: Menu },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 rounded-md px-1 py-1 text-[11px] text-[var(--muted)]">
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
