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
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { CreateEntityModal, CreateEntityState } from '@/components/create-entity-modal';
import { supabase } from '@/lib/supabase';
import { FocusShell } from './focus/focus-shell';
import { useUiMode } from './ui-mode-provider';
import { VoiceCommandButton } from './voice-command-button';

const nav = [
  { href: '/my-day', label: 'Мой день', icon: ClipboardList },
  { href: '/dashboard', label: 'Обзор', icon: Home },
  { href: '/today', label: 'Сегодня', icon: CheckSquare },
  { href: '/calendar', label: 'Календарь', icon: CalendarDays },
  { href: '/tasks', label: 'Задачи', icon: CheckSquare },
  { href: '/delegated', label: 'Делегированные', icon: Users },
  { href: '/executors', label: 'Исполнители', icon: Users },
  { href: '/projects', label: 'Проекты', icon: FolderKanban },
  { href: '/unassigned', label: 'Без проекта', icon: Menu },
  { href: '/search', label: 'Поиск', icon: Search },
  { href: '/files', label: 'Файлы', icon: FolderKanban },
  { href: '/trash', label: 'Корзина', icon: Trash2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { interfaceMode, resolvedAppearance, setAppearance } = useUiMode();
  const [createOpen, setCreateOpen] = useState(false);
  const [createModal, setCreateModal] = useState<CreateEntityState | null>(null);

  if (interfaceMode === 'focus') {
    return <FocusShell>{children}</FocusShell>;
  }

  function toggleTheme() {
    setAppearance(resolvedAppearance === 'dark' ? 'light' : 'dark');
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  function openCreate(state: CreateEntityState) {
    setCreateOpen(false);
    setCreateModal(state);
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[260px] border-r border-[var(--line)] bg-[var(--panel)] px-4 py-5 lg:flex lg:flex-col">
        <Link href="/my-day" className="mb-6 text-lg font-semibold">
          Personal Tasks
        </Link>
        <button
          className="btn-base btn-primary mb-4 h-11 w-full"
          onClick={() => setCreateOpen((value) => !value)}
        >
          <Plus size={18} /> Создать
        </button>
        {createOpen ? (
          <div className="mb-4 grid gap-2 rounded-lg border border-[var(--line)] bg-[var(--background)] p-2 text-sm">
            <button type="button" onClick={() => openCreate({ entity: 'task', kind: 'TASK' })} className="btn-base btn-ghost justify-start rounded-md px-3 py-2">Новая задача</button>
            <button type="button" onClick={() => openCreate({ entity: 'delegated' })} className="btn-base btn-ghost justify-start rounded-md px-3 py-2">Делегированная задача</button>
            <button type="button" onClick={() => openCreate({ entity: 'project' })} className="btn-base btn-ghost justify-start rounded-md px-3 py-2">Новый проект</button>
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
          { href: '/tasks?create=1', label: 'Создать', icon: Plus, create: true },
          { href: '/projects', label: 'Проекты', icon: FolderKanban },
          { href: '/dashboard', label: 'Ещё', icon: Menu },
        ].map((item) => {
          const Icon = item.icon;
          if (item.create) {
            return (
              <button key={item.href} type="button" onClick={() => openCreate({ entity: 'task', kind: 'TASK' })} className="flex flex-col items-center gap-1 rounded-md px-1 py-1 text-[11px] text-[var(--muted)]">
                <Icon size={18} />
                {item.label}
              </button>
            );
          }
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 rounded-md px-1 py-1 text-[11px] text-[var(--muted)]">
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <CreateEntityModal
        open={Boolean(createModal)}
        state={createModal ?? { entity: 'task', kind: 'TASK' }}
        onClose={() => setCreateModal(null)}
      />
    </div>
  );
}
