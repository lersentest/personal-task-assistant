import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Bot, ExternalLink } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Audit index',
  robots: {
    index: false,
    follow: false,
  },
};

const pageLinks = [
  { href: '/my-day', title: 'Мой день', hint: 'Планирование дня, обязательные и возможные задачи' },
  { href: '/dashboard', title: 'Обзор', hint: 'Сводка, риски, проекты и активность' },
  { href: '/tasks', title: 'Задачи', hint: 'Список задач, фильтры, создание и модалки' },
  { href: '/delegated', title: 'Делегированные', hint: 'Задачи исполнителей, очереди, комментарии и файлы' },
  { href: '/executors', title: 'Исполнители', hint: 'Справочник исполнителей' },
  { href: '/projects', title: 'Проекты', hint: 'Карточки проектов, прогресс и задачи' },
  { href: '/calendar', title: 'Календарь', hint: 'Месяц, неделя, день и список' },
  { href: '/files', title: 'Файлы', hint: 'Вложения и предпросмотр' },
  { href: '/search', title: 'Поиск', hint: 'Поиск по задачам, проектам и файлам' },
  { href: '/trash', title: 'Корзина', hint: 'Удалённые элементы' },
  { href: '/settings', title: 'Настройки', hint: 'Интерфейс и служебные разделы' },
];

const scenarioLinks = [
  { href: '/dashboard?ai=1', title: 'AI-чат', hint: 'Открыть модалку AI-аналитики' },
  { href: '/tasks?create=1&type=TASK', title: 'Создание задачи', hint: 'Модалка обычной задачи' },
  { href: '/projects?create=1', title: 'Создание проекта', hint: 'Модалка проекта' },
  { href: '/delegated', title: 'Создание делегированной', hint: 'Кнопка “Создать” в левом меню или на странице' },
  { href: '/not-found-audit-check', title: 'Страница 404', hint: 'Проверка обработки неизвестного маршрута' },
];

function AuditLink({ href, title, hint }: { href: string; title: string; hint: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-4 rounded-3xl border border-[var(--focus-border)] bg-[var(--focus-surface)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--focus-primary)] hover:shadow-[var(--focus-shadow)]"
    >
      <span>
        <span className="block text-base font-semibold text-[var(--focus-text)]">{title}</span>
        <span className="mt-1 block text-sm text-[var(--focus-text-muted)]">{hint}</span>
      </span>
      <ArrowUpRight size={18} className="text-[var(--focus-text-muted)] transition group-hover:text-[var(--focus-primary)]" />
    </Link>
  );
}

export default function AuditIndexPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8">
      <section className="rounded-[32px] border border-[var(--focus-border)] bg-[var(--focus-surface)] p-6 shadow-[var(--focus-shadow)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--focus-text-muted)]">
              Personal Task Assistant
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Audit index</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--focus-text-muted)]">
              Быстрые входы для внешнего аудита: основные страницы, сценарии с модалками,
              AI-чат, мобильная проверка и 404. Страница не показывается в навигации.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">
            <Bot size={16} />
            Режим внешнего аудита
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">Основные страницы</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pageLinks.map((link) => (
            <AuditLink key={link.href} {...link} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Сценарии и модалки</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {scenarioLinks.map((link) => (
            <AuditLink key={`${link.href}-${link.title}`} {...link} />
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-[28px] border border-[var(--focus-border)] bg-[var(--focus-surface-secondary)] p-5 text-sm text-[var(--focus-text-muted)]">
        <div className="flex items-start gap-3">
          <ExternalLink size={18} className="mt-0.5 text-[var(--focus-primary)]" />
          <p>
            Публичную страницу исполнителя можно открыть из любой делегированной задачи через кнопку
            “Ссылка”. Она работает отдельно от audit-cookie и имитирует внешний вход исполнителя.
          </p>
        </div>
      </section>
    </main>
  );
}
