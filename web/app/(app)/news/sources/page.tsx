'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, ShieldAlert, ToggleLeft, ToggleRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Page } from '@/components/page';
import { EmptyPanel, ErrorState, LoadingState, UiCard } from '@/components/ui-kit';
import { api } from '@/lib/api';
import type { NewsCategory, NewsSource } from '@/lib/types';

const categoryOptions: Array<{ value: NewsCategory; label: string }> = [
  { value: 'STONE_INDUSTRY', label: 'Каменная отрасль' },
  { value: 'STONE_MACHINERY', label: 'Оборудование' },
  { value: 'CONSTRUCTION', label: 'Строительство' },
  { value: 'SWISS_CONSTRUCTION', label: 'Швейцария' },
  { value: 'ARCHITECTURE', label: 'Архитектура' },
  { value: 'INTERIOR_DESIGN', label: 'Дизайн' },
  { value: 'MATERIALS', label: 'Материалы' },
  { value: 'BUSINESS_MARKET', label: 'Рынок' },
  { value: 'EVENTS', label: 'События' },
];

export default function NewsSourcesPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '',
    homepageUrl: '',
    feedUrl: '',
    category: 'STONE_INDUSTRY' as NewsCategory,
    language: 'EN',
    country: '',
    priority: 3,
  });
  const sources = useQuery({ queryKey: ['news-sources'], queryFn: api.newsSources });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: { enabled?: boolean; priority?: number } }) =>
      api.updateNewsSource(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['news-sources'] }),
  });
  const test = useMutation({
    mutationFn: (id: string) => api.testNewsSource(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['news-sources'] }),
  });
  const create = useMutation({
    mutationFn: () => api.createNewsSource(form),
    onSuccess: () => {
      setForm({
        name: '',
        homepageUrl: '',
        feedUrl: '',
        category: 'STONE_INDUSTRY',
        language: 'EN',
        country: '',
        priority: 3,
      });
      setShowAdd(false);
      queryClient.invalidateQueries({ queryKey: ['news-sources'] });
    },
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (sources.data ?? []).filter((source) =>
      [source.name, source.homepageUrl, source.feedUrl, source.language, source.country, source.category, source.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [query, sources.data]);

  return (
    <Page
      title="Источники новостей"
      description="Управление RSS/WEB-источниками. X и Instagram оставлены выключенными до официального API."
      actions={
        <button type="button" onClick={() => setShowAdd((value) => !value)} className="btn-base btn-primary">
          <Plus size={16} /> Добавить источник
        </button>
      }
    >
      <UiCard className="mb-5 p-4">
        <label className="flex h-12 items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--background)] px-4">
          <Search size={18} className="text-[var(--muted)]" />
          <input
            className="min-w-0 flex-1 bg-transparent outline-none"
            placeholder="Найти источник, категорию, страну..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </UiCard>

      {showAdd ? (
        <UiCard className="mb-5 grid gap-3 p-5">
          <h2 className="text-lg font-semibold">Новый источник</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 outline-none" placeholder="Название" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <input className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 outline-none" placeholder="Homepage URL" value={form.homepageUrl} onChange={(event) => setForm({ ...form, homepageUrl: event.target.value })} />
            <input className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 outline-none md:col-span-2" placeholder="RSS/Atom URL, если известен" value={form.feedUrl} onChange={(event) => setForm({ ...form, feedUrl: event.target.value })} />
            <select className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 outline-none" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as NewsCategory })}>
              {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <div className="grid grid-cols-3 gap-3">
              <input className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 outline-none" placeholder="Язык" value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })} />
              <input className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 outline-none" placeholder="Страна" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} />
              <input className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 outline-none" type="number" min={1} max={5} value={form.priority} onChange={(event) => setForm({ ...form, priority: Number(event.target.value) })} />
            </div>
          </div>
          {create.error ? <ErrorState text={create.error.message} /> : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="btn-base btn-secondary">Отмена</button>
            <button type="button" onClick={() => create.mutate()} disabled={create.isPending} className="btn-base btn-primary">Сохранить</button>
          </div>
        </UiCard>
      ) : null}

      {sources.isLoading ? <LoadingState text="Загружаю источники…" /> : null}
      {sources.error ? <ErrorState text={`Источники недоступны: ${sources.error.message}`} /> : null}
      {!sources.isLoading && !filtered.length ? <EmptyPanel title="Источники не найдены" text="Измени запрос или добавь новый источник." /> : null}

      <div className="grid gap-3">
        {filtered.map((source) => (
          <SourceRow
            key={source.id}
            source={source}
            onToggle={() => update.mutate({ id: source.id, input: { enabled: !source.enabled } })}
            onPriority={(priority) => update.mutate({ id: source.id, input: { priority } })}
            onTest={() => test.mutate(source.id)}
            busy={update.isPending || test.isPending}
          />
        ))}
      </div>
    </Page>
  );
}

function SourceRow({
  source,
  onToggle,
  onPriority,
  onTest,
  busy,
}: {
  source: NewsSource;
  onToggle: () => void;
  onPriority: (priority: number) => void;
  onTest: () => void;
  busy: boolean;
}) {
  const isSocial = source.sourceType === 'X' || source.sourceType === 'INSTAGRAM';
  return (
    <UiCard className="grid gap-3 p-4 lg:grid-cols-[1fr_220px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">{source.name}</h2>
          <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs text-[var(--accent)]">{source.sourceType}</span>
          <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-xs text-[var(--muted)]">{source.status}</span>
          {isSocial ? <ShieldAlert size={16} className="text-amber-500" /> : null}
        </div>
        <p className="mt-1 truncate text-sm text-[var(--muted)]">{source.feedUrl || source.homepageUrl}</p>
        {source.statusMessage ? <p className="mt-2 text-xs text-[var(--muted)]">{source.statusMessage}</p> : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <select
          className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 outline-none h-10 w-20"
          value={source.priority}
          onChange={(event) => onPriority(Number(event.target.value))}
          disabled={busy}
          aria-label="Приоритет источника"
        >
          {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <button type="button" className="btn-base btn-secondary" onClick={onTest} disabled={busy || isSocial}>
          Тест
        </button>
        <button type="button" className="btn-base btn-secondary" onClick={onToggle} disabled={busy || isSocial}>
          {source.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          {source.enabled ? 'Вкл' : 'Выкл'}
        </button>
      </div>
    </UiCard>
  );
}
