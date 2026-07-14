'use client';

import { useQuery } from '@tanstack/react-query';
import { Page } from '@/components/page';
import { api } from '@/lib/api';

export default function ProfilePage() {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  return (
    <Page title="Профиль">
      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5">
        <p>Email: {me.data?.email ?? 'Не указан'}</p>
        <p className="mt-2 text-sm text-[var(--muted)]">Часовой пояс: {me.data?.timezone ?? '...'}</p>
      </div>
    </Page>
  );
}

