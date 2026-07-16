'use client';

import { CalendarDays, CheckCircle2, Clock3, Plus } from 'lucide-react';
import { Page } from '@/components/page';
import { EmptyPanel, ErrorState, LoadingState, MetricStrip, PriorityBadge, StatusBadge, UiCard } from '@/components/ui-kit';

export default function UiKitPage() {
  return (
    <Page title="UI Kit" description="Эталонные элементы новой дизайн-системы Personal Task Assistant.">
      <div className="grid gap-5">
        <MetricStrip
          items={[
            { label: 'Запланировано', value: '4 ч 20 мин', icon: <Clock3 size={18} />, tone: 'blue' },
            { label: 'Свободно', value: '2 ч 40 мин', icon: <Clock3 size={18} />, tone: 'green' },
            { label: 'Выполнено', value: '5 из 9', icon: <CheckCircle2 size={18} />, tone: 'green' },
            { label: 'Всего задач', value: 14, icon: <CalendarDays size={18} />, tone: 'gray' },
          ]}
        />

        <UiCard className="p-5">
          <h2 className="mb-4 text-lg font-semibold">Кнопки</h2>
          <div className="flex flex-wrap gap-2">
            <button className="btn-base btn-primary"><Plus size={16} /> Primary</button>
            <button className="btn-base btn-secondary">Secondary</button>
            <button className="btn-base btn-ghost">Ghost</button>
            <button className="btn-base btn-success">Success</button>
            <button className="btn-base btn-warning">Warning</button>
            <button className="btn-base btn-danger">Danger</button>
            <button className="btn-base btn-primary" disabled>Disabled</button>
          </div>
        </UiCard>

        <UiCard className="p-5">
          <h2 className="mb-4 text-lg font-semibold">Badges</h2>
          <div className="flex flex-wrap gap-2">
            <PriorityBadge priority="URGENT" />
            <PriorityBadge priority="HIGH" />
            <PriorityBadge priority="NORMAL" />
            <PriorityBadge priority="LOW" />
            <StatusBadge status="NEW" />
            <StatusBadge status="IN_PROGRESS" />
            <StatusBadge status="COMPLETED" />
            <StatusBadge status="CANCELLED" />
          </div>
        </UiCard>

        <UiCard className="p-5">
          <h2 className="mb-4 text-lg font-semibold">Поля</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Название</span>
              <input className="rounded-xl border border-[var(--line)] px-3" placeholder="Название задачи" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Статус</span>
              <select className="rounded-xl border border-[var(--line)] px-3">
                <option>Новая</option>
                <option>В работе</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Описание</span>
              <textarea className="min-h-24 rounded-xl border border-[var(--line)] px-3 py-2" placeholder="Описание" />
            </label>
          </div>
        </UiCard>

        <div className="grid gap-5 lg:grid-cols-3">
          <LoadingState />
          <ErrorState text="Пример ошибки действия." />
          <EmptyPanel title="Пустое состояние" text="Здесь появятся данные после первого действия." />
        </div>
      </div>
    </Page>
  );
}
