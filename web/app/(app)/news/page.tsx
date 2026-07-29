'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { ExternalLink, Newspaper, RefreshCw, Rss } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Page } from '@/components/page';
import { EmptyPanel, ErrorState, LoadingState, UiCard } from '@/components/ui-kit';
import { api } from '@/lib/api';
import type { NewsCategory, NewsRun } from '@/lib/types';

const categoryLabel: Record<NewsCategory, string> = {
  STONE_INDUSTRY: 'Камень',
  STONE_MACHINERY: 'Оборудование',
  CONSTRUCTION: 'Строительство',
  SWISS_CONSTRUCTION: 'Швейцария',
  ARCHITECTURE: 'Архитектура',
  INTERIOR_DESIGN: 'Дизайн',
  MATERIALS: 'Материалы',
  BUSINESS_MARKET: 'Рынок',
  EVENTS: 'События',
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function NewsPage() {
  const [date, setDate] = useState(todayIso());
  const [activeRun, setActiveRun] = useState<NewsRun | null>(null);
  const news = useQuery({
    queryKey: ['news-today', date],
    queryFn: () => api.newsToday(date),
    refetchInterval: activeRun?.status === 'RUNNING' || activeRun?.status === 'QUEUED' ? 4000 : false,
  });
  const refresh = useMutation({
    mutationFn: () => api.refreshNews(),
    onSuccess: (run) => {
      setActiveRun(run);
      news.refetch();
    },
  });

  useEffect(() => {
    const run = news.data?.run;
    if (run?.status === 'RUNNING' || run?.status === 'QUEUED') setActiveRun(run);
    if (run && !['RUNNING', 'QUEUED'].includes(run.status)) setActiveRun(null);
  }, [news.data?.run]);

  const statusText = useMemo(() => {
    const run = activeRun ?? news.data?.run;
    if (!run) return 'Выпуск ещё не запускался';
    if (run.status === 'RUNNING' || run.status === 'QUEUED') return 'Собираю источники…';
    if (run.status === 'SUCCESS') return 'Выпуск готов';
    if (run.status === 'COOLDOWN') return 'Слишком частое обновление';
    if (run.status === 'PARTIAL') return 'Частичный выпуск';
    return 'Есть ошибка обновления';
  }, [activeRun, news.data?.run]);

  return (
    <Page
      title="Новости на сегодня"
      description="Короткая ежедневная сводка по камню, строительству, архитектуре, материалам и рынку."
      actions={
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="h-10 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 text-sm outline-none"
          />
          <Link href="/news/sources" className="btn-base btn-secondary">
            <Rss size={16} /> Источники
          </Link>
          <button
            type="button"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending || activeRun?.status === 'RUNNING'}
            className="btn-base btn-primary"
          >
            <RefreshCw size={16} className={refresh.isPending ? 'animate-spin' : ''} />
            Обновить
          </button>
        </div>
      }
    >
      <UiCard className="mb-5 grid gap-3 p-5 md:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Статус</p>
          <p className="mt-1 text-lg font-semibold">{statusText}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Последнее обновление</p>
          <p className="mt-1 text-lg font-semibold">{formatDate(news.data?.lastUpdateAt ?? null)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Источники</p>
          <p className="mt-1 text-lg font-semibold">{news.data?.sourcesCount ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Новостей</p>
          <p className="mt-1 text-lg font-semibold">{news.data?.items.length ?? '—'}</p>
        </div>
      </UiCard>

      {news.isLoading ? <LoadingState text="Загружаю выпуск…" /> : null}
      {news.error ? <ErrorState text={`Новости недоступны: ${news.error.message}`} /> : null}
      {refresh.error ? <ErrorState text={`Не удалось обновить: ${refresh.error.message}`} /> : null}

      {!news.isLoading && !news.error && !news.data?.items.length ? (
        <EmptyPanel
          title="Выпуск пока пустой"
          text="Нажми «Обновить». Если RSS не найдутся автоматически, добавь прямые RSS-ссылки на странице источников."
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {news.data?.items.map((item) => (
          <article
            key={item.id}
            className="interactive-card rounded-3xl border border-[var(--focus-border,var(--line))] bg-[var(--focus-surface,var(--panel))] p-5 shadow-sm"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <Newspaper size={16} />
                <span>{item.sourceName}</span>
                {item.publishedAt ? <span>· {formatDate(item.publishedAt)}</span> : null}
              </div>
              <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent)]">
                {categoryLabel[item.category]}
              </span>
            </div>
            <h2 className="text-xl font-semibold leading-tight">{item.title}</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{item.summary}</p>
            {item.warning ? (
              <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                {item.warning}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[var(--focus-surface-secondary,var(--background))] px-2.5 py-1 text-xs text-[var(--muted)]">
                  score {item.relevanceScore}
                </span>
                <span className="rounded-full bg-[var(--focus-surface-secondary,var(--background))] px-2.5 py-1 text-xs text-[var(--muted)]">
                  {item.language}
                </span>
              </div>
              <a href={item.url} target="_blank" rel="noreferrer" className="btn-base btn-secondary">
                Открыть <ExternalLink size={15} />
              </a>
            </div>
          </article>
        ))}
      </div>
    </Page>
  );
}
