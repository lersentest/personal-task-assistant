'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { EmptyState, Page } from '@/components/page';
import { api } from '@/lib/api';
import { Executor } from '@/lib/types';

const statusLabel: Record<string, string> = {
  NOT_CONNECTED: 'Не подключён',
  INVITE_CREATED: 'Приглашение создано',
  CONNECTED: 'Подключён',
  INACTIVE: 'Неактивен',
};

export default function ExecutorsPage() {
  const queryClient = useQueryClient();
  const executors = useQuery({ queryKey: ['executors'], queryFn: api.executors });
  const [form, setForm] = useState({ fullName: '', company: '', role: '', email: '', phone: '' });
  const [invite, setInvite] = useState<{ executorId: string; link: string; expiresAt: string } | null>(null);

  const create = useMutation({
    mutationFn: api.createExecutor,
    onSuccess: () => {
      setForm({ fullName: '', company: '', role: '', email: '', phone: '' });
      queryClient.invalidateQueries({ queryKey: ['executors'] });
    },
  });
  const inviteMutation = useMutation({
    mutationFn: api.inviteExecutor,
    onSuccess: (data, executorId) => {
      setInvite({ executorId, link: data.link, expiresAt: data.expiresAt });
      queryClient.invalidateQueries({ queryKey: ['executors'] });
    },
  });
  const remove = useMutation({
    mutationFn: api.deleteExecutor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['executors'] }),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    create.mutate({
      fullName: form.fullName,
      company: form.company || null,
      role: form.role || null,
      email: form.email || null,
      phone: form.phone || null,
      language: 'RU',
      timezone: 'Europe/Zurich',
      dailyDigestEnabled: true,
      dailyDigestTime: '08:00',
    });
  }

  return (
    <Page
      title="Исполнители"
      description="Люди, которым можно назначать отдельные делегированные задачи через Telegram."
    >
      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <form onSubmit={submit} className="grid content-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Новый исполнитель</h2>
          <input className="rounded-xl border border-[var(--line)] bg-transparent px-3 py-2" placeholder="Имя *" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <input className="rounded-xl border border-[var(--line)] bg-transparent px-3 py-2" placeholder="Компания" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <input className="rounded-xl border border-[var(--line)] bg-transparent px-3 py-2" placeholder="Роль" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          <input className="rounded-xl border border-[var(--line)] bg-transparent px-3 py-2" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="rounded-xl border border-[var(--line)] bg-transparent px-3 py-2" placeholder="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <button disabled={create.isPending} className="rounded-xl bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)]">
            Создать
          </button>
          {create.error ? <p className="text-sm text-red-600">{create.error.message}</p> : null}
        </form>

        <section className="grid gap-3">
          {executors.data?.length ? executors.data.map((executor) => (
            <ExecutorCard
              key={executor.id}
              executor={executor}
              inviteLink={invite?.executorId === executor.id ? invite.link : null}
              onInvite={() => inviteMutation.mutate(executor.id)}
              onDelete={() => remove.mutate(executor.id)}
            />
          )) : <EmptyState text="Исполнителей пока нет." />}
        </section>
      </div>
    </Page>
  );
}

function ExecutorCard({
  executor,
  inviteLink,
  onInvite,
  onDelete,
}: {
  executor: Executor;
  inviteLink: string | null;
  onInvite: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{executor.fullName}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {[executor.role, executor.company].filter(Boolean).join(' · ') || 'Без роли'}
          </p>
          <p className="mt-2 text-sm">
            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[var(--accent)]">
              {statusLabel[executor.connectionStatus] ?? executor.connectionStatus}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onInvite} className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm hover:bg-[var(--background)]">
            Подключить Telegram
          </button>
          <button onClick={onDelete} className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
            Удалить
          </button>
        </div>
      </div>
      {inviteLink ? (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <p className="font-medium">Ссылка для подключения:</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input readOnly value={inviteLink} className="min-w-0 flex-1 rounded-lg border border-blue-200 bg-white px-3 py-2" />
            <button onClick={() => navigator.clipboard?.writeText(inviteLink)} className="rounded-lg bg-blue-600 px-3 py-2 text-white">
              Скопировать
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
