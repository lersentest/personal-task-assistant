'use client';

import {
  Archive,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Command,
  FileText,
  FolderKanban,
  Home,
  Lightbulb,
  LogOut,
  Menu,
  Mic,
  Moon,
  Phone,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CreateEntityModal, CreateEntityState } from '@/components/create-entity-modal';
import { DelegatedTaskDetailsModal } from '@/components/delegated-task-detail-modal';
import { FileDetailsModal } from '@/components/file-detail-modal';
import { ProjectDetailsModal } from '@/components/project-detail-modal';
import { TaskDetailsModal } from '@/components/task-detail-modal';
import { api } from '@/lib/api';
import type { Attachment, DelegatedTask, Project, Task, TaskKind } from '@/lib/types';
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
      { href: '/delegated', label: 'Делегированные', icon: Users },
      { href: '/executors', label: 'Исполнители', icon: Users },
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

const createItems = [
  { label: 'Задача', href: '/tasks?create=1&type=TASK', icon: CheckSquare, hint: 'Обычная рабочая задача', entity: 'task', kind: 'TASK' },
  { label: 'Делегированная', href: '/delegated', icon: Users, hint: 'Задача для исполнителя', entity: 'delegated' },
  { label: 'Звонок', href: '/tasks?create=1&type=CALL', icon: Phone, hint: 'Запланировать звонок', entity: 'task', kind: 'CALL' },
  { label: 'Встреча', href: '/tasks?create=1&type=MEETING', icon: Users, hint: 'Встреча или созвон', entity: 'task', kind: 'MEETING' },
  { label: 'Идея', href: '/tasks?create=1&type=IDEA', icon: Lightbulb, hint: 'Быстро сохранить мысль', entity: 'task', kind: 'IDEA' },
  { label: 'Заметка', href: '/tasks?create=1&type=NOTE', icon: FileText, hint: 'Текстовая заметка', entity: 'task', kind: 'NOTE' },
  { label: 'Проект', href: '/projects?create=1', icon: FolderKanban, hint: 'Новый проект', entity: 'project' },
];

const commands = [
  { label: 'Перейти в Мой день', href: '/my-day', hint: 'Планирование дня' },
  { label: 'Открыть обзор', href: '/dashboard', hint: 'Сегодня, риски, проекты, активность' },
  { label: 'Открыть календарь', href: '/calendar', hint: 'Месяц, неделя, день, список' },
  { label: 'Создать задачу', href: '/tasks?create=1&type=TASK', hint: 'Новая задача', create: { entity: 'task', kind: 'TASK' } },
  { label: 'Создать делегированную задачу', href: '/delegated', hint: 'Задача для исполнителя', create: { entity: 'delegated' } },
  { label: 'Создать звонок', href: '/tasks?create=1&type=CALL', hint: 'Тип задачи: звонок', create: { entity: 'task', kind: 'CALL' } },
  { label: 'Создать встречу', href: '/tasks?create=1&type=MEETING', hint: 'Тип задачи: встреча', create: { entity: 'task', kind: 'MEETING' } },
  { label: 'Создать проект', href: '/projects?create=1', hint: 'Новый проект', create: { entity: 'project' } },
  { label: 'Найти задачу', href: '/search', hint: 'Поиск по системе' },
  { label: 'Открыть файлы', href: '/files', hint: 'Вложения и документы' },
];

function matchesQuery(parts: Array<string | null | undefined>, query: string) {
  return parts.filter(Boolean).join(' ').toLowerCase().includes(query);
}

function taskSearchParts(task: Task) {
  return [
    task.title,
    task.description,
    task.status,
    task.priority,
    task.kind,
    task.project?.name,
    ...(task.tags ?? []).map((link) => link.tag.name),
  ];
}

function delegatedTaskSearchParts(task: DelegatedTask) {
  return [
    task.title,
    task.description,
    task.resultText,
    task.status,
    task.priority,
    task.executor?.fullName,
    task.project?.name,
  ];
}

function projectSearchParts(project: Project) {
  return [project.name, project.description, project.status];
}

function fileSearchParts(file: Attachment) {
  return [
    file.fileName,
    file.mimeType,
    file.task?.title,
    file.project?.name,
    file.delegatedTask?.title,
  ];
}

export function FocusShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { appearance, setAppearance } = useUiMode();
  const [createOpen, setCreateOpen] = useState(false);
  const [createModal, setCreateModal] = useState<CreateEntityState | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedDelegatedTaskId, setSelectedDelegatedTaskId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<Attachment | null>(null);

  const globalSearch = useQuery({
    queryKey: ['global-search'],
    queryFn: () => api.search(),
    enabled: paletteOpen,
    staleTime: 30_000,
  });

  const searchQuery = commandQuery.trim().toLowerCase();
  const hasSearchQuery = searchQuery.length >= 2;

  const filteredCommands = useMemo(() => {
    const value = searchQuery;
    if (!value) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.hint}`.toLowerCase().includes(value),
    );
  }, [searchQuery]);

  const taskResults = useMemo(
    () =>
      hasSearchQuery
        ? (globalSearch.data?.tasks ?? [])
            .filter((task) => matchesQuery(taskSearchParts(task), searchQuery))
            .slice(0, 6)
        : [],
    [globalSearch.data?.tasks, hasSearchQuery, searchQuery],
  );

  const delegatedTaskResults = useMemo(
    () =>
      hasSearchQuery
        ? (globalSearch.data?.delegatedTasks ?? [])
            .filter((task) => matchesQuery(delegatedTaskSearchParts(task), searchQuery))
            .slice(0, 5)
        : [],
    [globalSearch.data?.delegatedTasks, hasSearchQuery, searchQuery],
  );

  const projectResults = useMemo(
    () =>
      hasSearchQuery
        ? (globalSearch.data?.projects ?? [])
            .filter((project) => matchesQuery(projectSearchParts(project), searchQuery))
            .slice(0, 4)
        : [],
    [globalSearch.data?.projects, hasSearchQuery, searchQuery],
  );

  const fileResults = useMemo(
    () =>
      hasSearchQuery
        ? (globalSearch.data?.files ?? [])
            .filter((file) => matchesQuery(fileSearchParts(file), searchQuery))
            .slice(0, 4)
        : [],
    [globalSearch.data?.files, hasSearchQuery, searchQuery],
  );

  const resultCount =
    taskResults.length + delegatedTaskResults.length + projectResults.length + fileResults.length;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (!typing && event.key.toLowerCase() === 'n') {
        setCreateModal({ entity: 'task', kind: 'TASK' });
      }
      if (!typing && event.key.toLowerCase() === 'p') {
        setCreateModal({ entity: 'project' });
      }
      if (!typing && event.key === '/') {
        event.preventDefault();
        router.push('/search');
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false);
        setCreateOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  function cycleAppearance() {
    setAppearance(
      appearance === 'light' ? 'dark' : appearance === 'dark' ? 'system' : 'light',
    );
  }

  function go(href: string) {
    setPaletteOpen(false);
    setCreateOpen(false);
    setMobileMenuOpen(false);
    setCommandQuery('');
    router.push(href);
  }

  function openTaskFromSearch(taskId: string) {
    setPaletteOpen(false);
    setCreateOpen(false);
    setMobileMenuOpen(false);
    setCommandQuery('');
    setSelectedTaskId(taskId);
  }

  function openDelegatedTaskFromSearch(taskId: string) {
    setPaletteOpen(false);
    setCreateOpen(false);
    setMobileMenuOpen(false);
    setCommandQuery('');
    setSelectedDelegatedTaskId(taskId);
  }

  function openProjectFromSearch(projectId: string) {
    setPaletteOpen(false);
    setCreateOpen(false);
    setMobileMenuOpen(false);
    setCommandQuery('');
    setSelectedProjectId(projectId);
  }

  function openFileFromSearch(file: Attachment) {
    setPaletteOpen(false);
    setCreateOpen(false);
    setMobileMenuOpen(false);
    setCommandQuery('');
    setSelectedFile(file);
  }

  function openCreate(state: CreateEntityState) {
    setPaletteOpen(false);
    setCreateOpen(false);
    setMobileMenuOpen(false);
    setCommandQuery('');
    setCreateModal(state);
  }

  function openCreateItem(item: (typeof createItems)[number]) {
    if (item.entity === 'delegated') {
      openCreate({ entity: 'delegated' });
      return;
    }
    openCreate(
      item.entity === 'project'
        ? { entity: 'project' }
        : { entity: 'task', kind: item.kind as TaskKind },
    );
  }

  function openMobileMenu(event: React.MouseEvent) {
    event?.preventDefault();
    event?.stopPropagation();
    setMobileMenuOpen(true);
  }

  return (
    <div className="min-h-screen bg-[var(--focus-bg)] text-[var(--focus-text)] lg:grid lg:grid-cols-[292px_1fr]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[292px] border-r border-[var(--focus-border-soft)] bg-[var(--focus-surface)]/96 px-4 py-5 shadow-[var(--focus-shadow)] backdrop-blur lg:flex lg:flex-col">
        <Link href="/my-day" className="mb-7 flex items-center gap-3 px-1">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--focus-primary)] text-white shadow-sm">
            <CheckSquare size={19} />
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[var(--focus-surface)] bg-[var(--focus-success)]" />
          </span>
          <span>
            <span className="block text-lg font-semibold tracking-tight">Personal Tasks</span>
            <span className="block text-xs text-[var(--focus-text-muted)]">Focus workspace</span>
          </span>
        </Link>

        <div className="relative mb-7">
          <button
            onClick={() => setCreateOpen((value) => !value)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--focus-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--focus-primary-hover)]"
          >
            <Plus size={18} />
            Создать
            <ChevronDown size={16} className="ml-auto" />
          </button>
          {createOpen ? (
            <div className="absolute left-0 right-0 top-14 z-40 grid gap-1 rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface)] p-2 text-sm shadow-[var(--focus-shadow)]">
              {createItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    onClick={() => openCreateItem(item)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-[var(--focus-primary-soft)]"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--focus-surface-secondary)] text-[var(--focus-primary)]">
                      <Icon size={16} />
                    </span>
                    <span>
                      <span className="block font-medium">{item.label}</span>
                      <span className="text-xs text-[var(--focus-text-muted)]">{item.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <nav className="grid gap-6">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--focus-text-muted)]">
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
                      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                        active
                          ? 'bg-[var(--focus-primary-soft)] text-[var(--focus-primary)] shadow-sm'
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
            className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-[var(--focus-surface-secondary)]"
          >
            {appearance === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
            {appearance === 'system' ? 'Системная тема' : appearance === 'dark' ? 'Тёмная тема' : 'Светлая тема'}
          </button>
          <Link href="/settings" className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-[var(--focus-surface-secondary)]">
            <Settings size={18} /> Настройки
          </Link>
          <Link href="/profile" className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-[var(--focus-surface-secondary)]">
            <User size={18} /> Профиль
          </Link>
          <button onClick={logout} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-[var(--focus-surface-secondary)]">
            <LogOut size={18} /> Выход
          </button>
        </div>
      </aside>

      <div className="lg:col-start-2">
        <header className="sticky top-0 z-20 border-b border-[var(--focus-border-soft)] bg-[var(--focus-bg)]/88 px-4 py-3 backdrop-blur-xl lg:px-8">
          <div className="mx-auto flex max-w-[1600px] items-center gap-3">
            <button
              type="button"
              onClick={openMobileMenu}
              aria-label="Открыть меню"
              className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--focus-border)] bg-[var(--focus-surface)] px-3 py-2 text-sm font-semibold text-[var(--focus-text-secondary)] lg:hidden"
            >
              <Menu size={20} />
              <span className="sr-only sm:not-sr-only">Меню</span>
            </button>
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden h-11 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface)] px-4 text-sm text-[var(--focus-text-muted)] shadow-sm transition hover:border-[var(--focus-primary)] md:flex md:max-w-[620px]"
            >
              <Search size={18} />
              Поиск по задачам, проектам, тегам...
              <span className="ml-auto inline-flex items-center gap-1 rounded-lg bg-[var(--focus-surface-secondary)] px-2 py-1 text-xs text-[var(--focus-text-muted)]">
                <Command size={13} /> K
              </span>
            </button>
            <div className="ml-auto flex items-center gap-2">
              <VoiceCommandButton variant="inline" />
              <button
                onClick={() => setPaletteOpen(true)}
                className="hidden h-11 items-center gap-2 rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface)] px-4 text-sm font-semibold shadow-sm transition hover:bg-[var(--focus-surface-secondary)] sm:flex"
              >
                <Sparkles size={17} />
                Команды
              </button>
              <button
                onClick={() => openCreate({ entity: 'task', kind: 'TASK' })}
                className="hidden h-11 items-center gap-2 rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface)] px-4 text-sm font-semibold shadow-sm transition hover:bg-[var(--focus-surface-secondary)] sm:flex"
              >
                <Plus size={18} />
                Создать
              </button>
              <Link
                href="/profile"
                className="flex h-11 items-center gap-3 rounded-2xl px-2 text-sm hover:bg-[var(--focus-surface-secondary)]"
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

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[var(--focus-border)] bg-[var(--focus-surface)] px-1 py-2 shadow-[var(--focus-shadow)] lg:hidden">
        {[
          { href: '/my-day', label: 'Мой день', icon: Sun },
          { href: '/calendar', label: 'Календарь', icon: CalendarDays },
          { href: '/tasks?create=1', label: 'Создать', icon: Plus, create: true },
          { href: '/tasks', label: 'Задачи', icon: CheckSquare },
          { href: '/menu', label: 'Ещё', icon: Menu, menu: true },
        ].map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          if (item.menu) {
            return (
              <button
                key={item.href}
                type="button"
                onClick={openMobileMenu}
                className="flex flex-col items-center gap-1 rounded-xl px-1 py-1 text-[11px] text-[var(--focus-text-secondary)]"
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          }
          if (item.create) {
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => openCreate({ entity: 'task', kind: 'TASK' })}
                className="flex flex-col items-center gap-1 rounded-xl px-1 py-1 text-[11px] text-[var(--focus-primary)]"
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 rounded-xl px-1 py-1 text-[11px] ${
                active ? 'text-[var(--focus-primary)]' : 'text-[var(--focus-text-secondary)]'
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div
        role="dialog"
        aria-modal={mobileMenuOpen ? 'true' : undefined}
        aria-hidden={!mobileMenuOpen}
        className={`fixed inset-0 z-[10020] bg-slate-950/45 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          mobileMenuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setMobileMenuOpen(false)}
      >
        <aside
          className={`flex h-full w-[min(92vw,380px)] flex-col overflow-y-auto border-r border-[var(--focus-border)] bg-[var(--focus-surface)] p-4 shadow-2xl transition-transform duration-200 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          onClick={(event) => event.stopPropagation()}
        >
            <div className="mb-4 flex items-center justify-between gap-3">
              <Link href="/my-day" className="flex min-w-0 items-center gap-3">
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--focus-primary)] text-white shadow-sm">
                  <CheckSquare size={19} />
                  <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[var(--focus-surface)] bg-[var(--focus-success)]" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-base font-semibold tracking-tight">Personal Tasks</span>
                  <span className="block text-xs text-[var(--focus-text-muted)]">Focus workspace</span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Закрыть меню"
                className="rounded-xl border border-[var(--focus-border)] bg-[var(--focus-surface-secondary)] p-2 text-[var(--focus-text-secondary)]"
              >
                <X size={18} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setPaletteOpen(true);
              }}
              className="mb-4 flex h-11 items-center gap-3 rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface-secondary)] px-3 text-left text-sm text-[var(--focus-text-muted)]"
            >
              <Search size={17} />
              Поиск и команды
              <span className="ml-auto rounded-lg bg-[var(--focus-surface)] px-2 py-1 text-xs">⌘K</span>
            </button>

            <div className="mb-5 grid grid-cols-2 gap-2">
              {createItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => openCreateItem(item)}
                    className="flex min-h-20 flex-col items-start justify-between rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface-secondary)] p-3 text-left text-sm"
                  >
                    <Icon size={17} className="text-[var(--focus-primary)]" />
                    <span className="font-semibold">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <nav className="grid gap-5">
              {sections.map((section) => (
                <div key={section.title}>
                  <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--focus-text-muted)]">
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
                          className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition ${
                            active
                              ? 'bg-[var(--focus-primary-soft)] text-[var(--focus-primary)] shadow-sm'
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

            <div className="mt-5 grid gap-1 border-t border-[var(--focus-border-soft)] pt-4 text-sm text-[var(--focus-text-secondary)]">
              <button
                onClick={cycleAppearance}
                className="flex items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-[var(--focus-surface-secondary)]"
              >
                {appearance === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                {appearance === 'system' ? 'Системная тема' : appearance === 'dark' ? 'Тёмная тема' : 'Светлая тема'}
              </button>
              <Link href="/settings" className="flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-[var(--focus-surface-secondary)]">
                <Settings size={18} /> Настройки
              </Link>
              <Link href="/profile" className="flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-[var(--focus-surface-secondary)]">
                <User size={18} /> Профиль
              </Link>
              <button onClick={logout} className="flex items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-[var(--focus-surface-secondary)]">
                <LogOut size={18} /> Выход
              </button>
            </div>
        </aside>
      </div>

      {paletteOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 p-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-3xl border border-[var(--focus-border)] bg-[var(--focus-surface)] shadow-[var(--focus-shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-[var(--focus-border-soft)] px-4">
              <Search size={18} className="text-[var(--focus-text-muted)]" />
              <input
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                autoFocus
                placeholder="Поиск по задачам, проектам, файлам или команда..."
                className="h-14 flex-1 bg-transparent outline-none"
              />
              <span className="rounded-lg bg-[var(--focus-surface-secondary)] px-2 py-1 text-xs text-[var(--focus-text-muted)]">Esc</span>
            </div>
            <div className="max-h-[420px] overflow-y-auto p-2">
              {hasSearchQuery ? (
                <div className="mb-2 grid gap-2">
                  {globalSearch.isLoading ? (
                    <p className="rounded-2xl bg-[var(--focus-surface-secondary)] px-3 py-4 text-sm text-[var(--focus-text-muted)]">
                      Ищу по задачам, проектам и файлам...
                    </p>
                  ) : null}

                  {globalSearch.isError ? (
                    <p className="rounded-2xl bg-red-50 px-3 py-4 text-sm text-red-600">
                      Не удалось загрузить результаты поиска. Попробуй ещё раз.
                    </p>
                  ) : null}

                  {taskResults.length > 0 ? (
                    <section>
                      <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--focus-text-muted)]">
                        Задачи
                      </p>
                      {taskResults.map((task) => (
                        <button
                          key={task.id}
                          onClick={() => openTaskFromSearch(task.id)}
                          className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-[var(--focus-primary-soft)]"
                        >
                          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--focus-primary-soft)] text-[var(--focus-primary)]">
                            <CheckSquare size={17} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{task.title}</span>
                            <span className="mt-0.5 block truncate text-sm text-[var(--focus-text-muted)]">
                              {task.project?.name ?? 'Без проекта'} · {task.priority} · {task.status}
                            </span>
                          </span>
                        </button>
                      ))}
                    </section>
                  ) : null}

                  {delegatedTaskResults.length > 0 ? (
                    <section>
                      <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--focus-text-muted)]">
                        Делегированные
                      </p>
                      {delegatedTaskResults.map((task) => (
                        <button
                          key={task.id}
                          onClick={() => openDelegatedTaskFromSearch(task.id)}
                          className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-[var(--focus-primary-soft)]"
                        >
                          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--focus-surface-secondary)] text-[var(--focus-primary)]">
                            <Users size={17} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{task.title}</span>
                            <span className="mt-0.5 block truncate text-sm text-[var(--focus-text-muted)]">
                              {task.executor?.fullName ?? 'Исполнитель'} · {task.project?.name ?? 'Без проекта'} · {task.status}
                            </span>
                          </span>
                        </button>
                      ))}
                    </section>
                  ) : null}

                  {projectResults.length > 0 ? (
                    <section>
                      <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--focus-text-muted)]">
                        Проекты
                      </p>
                      {projectResults.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => openProjectFromSearch(project.id)}
                          className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-[var(--focus-primary-soft)]"
                        >
                          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--focus-surface-secondary)] text-[var(--focus-primary)]">
                            <FolderKanban size={17} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{project.name}</span>
                            <span className="mt-0.5 block truncate text-sm text-[var(--focus-text-muted)]">
                              {project.description ?? project.status}
                            </span>
                          </span>
                        </button>
                      ))}
                    </section>
                  ) : null}

                  {fileResults.length > 0 ? (
                    <section>
                      <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--focus-text-muted)]">
                        Файлы
                      </p>
                      {fileResults.map((file) => (
                        <button
                          key={file.id}
                          onClick={() => openFileFromSearch(file)}
                          className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-[var(--focus-primary-soft)]"
                        >
                          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--focus-surface-secondary)] text-[var(--focus-primary)]">
                            <Archive size={17} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{file.fileName}</span>
                            <span className="mt-0.5 block truncate text-sm text-[var(--focus-text-muted)]">
                              {file.task?.title ?? file.delegatedTask?.title ?? file.project?.name ?? file.mimeType}
                            </span>
                          </span>
                        </button>
                      ))}
                    </section>
                  ) : null}

                  {!globalSearch.isLoading && resultCount === 0 ? (
                    <p className="rounded-2xl bg-[var(--focus-surface-secondary)] px-3 py-5 text-center text-sm text-[var(--focus-text-muted)]">
                      По задачам, проектам и файлам ничего не найдено.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="px-3 py-3 text-sm text-[var(--focus-text-muted)]">
                  Введите минимум 2 символа, чтобы найти задачу, проект или файл.
                </p>
              )}

              {filteredCommands.length > 0 ? (
                <section className={hasSearchQuery ? 'mt-3 border-t border-[var(--focus-border-soft)] pt-2' : ''}>
                  <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--focus-text-muted)]">
                    Быстрые команды
                  </p>
                  {filteredCommands.map((command) => (
                    <button
                      key={`${command.href}-${command.label}`}
                      onClick={() => command.create ? openCreate(command.create as CreateEntityState) : go(command.href)}
                      className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left hover:bg-[var(--focus-primary-soft)]"
                    >
                      <span>
                        <span className="block font-medium">{command.label}</span>
                        <span className="text-sm text-[var(--focus-text-muted)]">{command.hint}</span>
                      </span>
                      <Command size={16} className="text-[var(--focus-text-muted)]" />
                    </button>
                  ))}
                </section>
              ) : null}
            </div>
            <div className="flex items-center gap-2 border-t border-[var(--focus-border-soft)] bg-[var(--focus-surface-secondary)] px-4 py-3 text-xs text-[var(--focus-text-muted)]">
              <Mic size={14} />
              Голосовую команду можно запустить кнопкой микрофона или Alt+V.
            </div>
          </div>
        </div>
      ) : null}
      <CreateEntityModal
        open={Boolean(createModal)}
        state={createModal ?? { entity: 'task', kind: 'TASK' }}
        onClose={() => setCreateModal(null)}
      />
      {selectedTaskId ? (
        <TaskDetailsModal
          taskId={selectedTaskId}
          open={Boolean(selectedTaskId)}
          onClose={() => setSelectedTaskId(null)}
        />
      ) : null}
      {selectedDelegatedTaskId ? (
        <DelegatedTaskDetailsModal
          taskId={selectedDelegatedTaskId}
          open={Boolean(selectedDelegatedTaskId)}
          onClose={() => setSelectedDelegatedTaskId(null)}
        />
      ) : null}
      {selectedProjectId ? (
        <ProjectDetailsModal
          projectId={selectedProjectId}
          open={Boolean(selectedProjectId)}
          onClose={() => setSelectedProjectId(null)}
        />
      ) : null}
      {selectedFile ? (
        <FileDetailsModal
          attachment={selectedFile}
          open={Boolean(selectedFile)}
          onClose={() => setSelectedFile(null)}
        />
      ) : null}
    </div>
  );
}
