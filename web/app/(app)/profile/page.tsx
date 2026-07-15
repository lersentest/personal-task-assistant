'use client';

import { useQuery } from '@tanstack/react-query';
import { Page } from '@/components/page';
import { api } from '@/lib/api';

export default function ProfilePage() {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  return (
    <Page title="Профиль" description="Данные текущего пользователя и рабочие настройки.">
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xl font-semibold text-[var(--accent)]">В</span>
          <div>
            <p className="font-semibold">Вадим</p>
            <p className="text-sm text-[var(--muted)]">{me.data?.email ?? 'Email не указан'}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-[var(--background)] p-4">
            <p className="text-[var(--muted)]">Часовой пояс</p>
            <p className="mt-1 font-medium">{me.data?.timezone ?? '...'}</p>
          </div>
          <div className="rounded-xl bg-[var(--background)] p-4">
            <p className="text-[var(--muted)]">Режим работы</p>
            <p className="mt-1 font-medium">Personal Tasks</p>
          </div>
        </div>
      </div>
    </Page>
  );
}
