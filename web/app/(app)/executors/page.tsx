'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { EmptyState, Page } from '@/components/page';
import { api } from '@/lib/api';
import { Executor } from '@/lib/types';

const statusLabel: Record<string, string> = {
  NOT_CONNECTED: 'Не подключён',
  INVITE_CREATED: 'Приглашение создано',
  CONNECTED: 'Подключён',
  INACTIVE: 'Неактивен',
};

const emptyForm = { fullName: '', company: '', role: '', email: '', phone: '' };

export default function ExecutorsPage() {
  const queryClient = useQueryClient();
  const executors = useQuery({ queryKey: ['executors'], queryFn: api.executors });
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ executorId: string; link: string; expiresAt: string } | null>(null);
  const canSubmit = useMemo(() => form.fullName.trim().length > 0, [form.fullName]);

  const create = useMutation({
    mutationFn: api.createExecutor,
    onMutate: () => setMessage(null),
    onSuccess: async (executor) => {
      setForm(emptyForm);
      setMessage(`Исполнитель «${executor.fullName}» создан.`);
      await queryClient.invalidateQueries({ queryKey: ['executors'] });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: api.inviteExecutor,
    onSuccess: async (data, executorId) => {
      setInvite({ executorId, link: data.link, expiresAt: data.expiresAt });
      await queryClient.invalidateQueries({ queryKey: ['executors'] });
    },
  });

  const remove = useMutation({
    mutationFn: api.deleteExecutor,
    onSuccess: async () => {
      setMessage('Исполнитель удалён.');
      await queryClient.invalidateQueries({ queryKey: ['executors'] });
    },
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || create.isPending) return;
    create.mutate({
      fullName: form.fullName.trim(),
      company: form.company.trim() || null,
      role: form.role.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      language: 'RU',
      timezone: 'Europe/Zurich',
      dailyDigestEnabled: true,
      dailyDigestTime: '08:00',
    });
  }

  return (
    <Page
      title="Исполнители"
      description="Люди, которым можно назначать делегированные задачи через Telegram."
    >
      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <form onSubmit={submit} className="grid content-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">Новый исполнитель</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Минимально нужно только имя. Остальное можно заполнить позже.
            </p>
          </div>
          <input className="rounded-xl border border-[var(--line)] bg-transparent px-3 py-2" placeholder="Имя *" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <input className="rounded-xl border border-[var(--line)] bg-transparent px-3 py-2" placeholder="Компания" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <input className="rounded-xl border border-[var(--line)] bg-transparent px-3 py-2" placeholder="Роль" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          <input className="rounded-xl border border-[var(--line)] bg-transparent px-3 py-2" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="rounded-xl border border-[var(--line)] bg-transparent px-3 py-2" placeholder="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <button
            disabled={!canSubmit || create.isPending}
            className="btn-base btn-primary"
          >
            {create.isPending ? 'Создаю...' : 'Создать исполнителя'}
          </button>
          {message ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {message}
            </p>
          ) : null}
          {create.error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Не удалось создать исполнителя: {create.error.message}
            </p>
          ) : null}
        </form>

        <section className="grid content-start gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Список исполнителей</h2>
            {executors.data ? (
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-sm text-[var(--accent)]">
                {executors.data.length}
              </span>
            ) : null}
          </div>

          {executors.isLoading ? (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 text-sm text-[var(--muted)]">
              Загружаю исполнителей...
            </div>
          ) : null}

          {executors.error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              Не удалось загрузить исполнителей: {executors.error.message}
            </div>
          ) : null}

          {executors.data?.length ? executors.data.map((executor) => (
            <ExecutorCard
              key={executor.id}
              executor={executor}
              inviteLink={invite?.executorId === executor.id ? invite.link : null}
              onInvite={() => inviteMutation.mutate(executor.id)}
              onDelete={() => {
                if (window.confirm(`Удалить исполнителя «${executor.fullName}»?`)) {
                  remove.mutate(executor.id);
                }
              }}
            />
          )) : null}

          {!executors.isLoading && !executors.error && !executors.data?.length ? (
            <EmptyState text="Исполнителей пока нет. Добавьте первого слева." />
          ) : null}
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
    <article className="interactive-card rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{executor.fullName}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {[executor.role, executor.company].filter(Boolean).join(' · ') || 'Без роли'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
            {executor.email ? <span>{executor.email}</span> : null}
            {executor.phone ? <span>{executor.phone}</span> : null}
            <span>{executor._count?.delegatedTasks ?? 0} задач</span>
          </div>
          <p className="mt-3 text-sm">
            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[var(--accent)]">
              {statusLabel[executor.connectionStatus] ?? executor.connectionStatus}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onInvite} className="btn-base btn-secondary">
            Подключить Telegram
          </button>
          <button onClick={onDelete} className="btn-base btn-danger">
            Удалить
          </button>
        </div>
      </div>
      {inviteLink ? (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <p className="font-medium">Ссылка для подключения:</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input readOnly value={inviteLink} className="min-w-0 flex-1 rounded-lg border border-blue-200 bg-white px-3 py-2" />
            <button onClick={() => navigator.clipboard?.writeText(inviteLink)} className="btn-base btn-primary">
              Скопировать
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
