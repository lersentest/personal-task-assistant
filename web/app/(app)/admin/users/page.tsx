'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Lock, RefreshCw, Shield, ShieldCheck, UserPlus } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { useCurrentUser } from '@/components/auth-gate';
import { Page } from '@/components/page';
import { ErrorState, LoadingState } from '@/components/ui-kit';
import { api } from '@/lib/api';
import type { AuthUser } from '@/lib/auth';

type ManagedUser = AuthUser & {
  _count?: {
    authSessions: number;
    mobileDeviceSessions: number;
  };
};

const emptyForm = {
  email: '',
  displayName: '',
  password: '',
  role: 'USER' as 'USER' | 'PLATFORM_ADMIN',
};

export default function AdminUsersPage() {
  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [resetPassword, setResetPassword] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const users = useQuery({
    queryKey: ['auth-users'],
    queryFn: () => api.authUsers() as Promise<ManagedUser[]>,
    enabled: currentUser?.role === 'PLATFORM_ADMIN',
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['auth-users'] });

  const createUser = useMutation({
    mutationFn: () => api.createAuthUser(form),
    onSuccess: () => {
      setForm(emptyForm);
      setMessage('Пользователь создан. При первом входе он должен сменить пароль.');
      invalidate();
    },
  });

  const resetUserPassword = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => api.resetAuthUserPassword(id, password),
    onSuccess: (_, variables) => {
      setResetPassword((value) => ({ ...value, [variables.id]: '' }));
      setMessage('Пароль сброшен, активные сессии пользователя отозваны.');
      invalidate();
    },
  });

  const setUserStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'BLOCKED' }) => api.setAuthUserStatus(id, status),
    onSuccess: () => {
      setMessage('Статус пользователя обновлён.');
      invalidate();
    },
  });

  const revokeSessions = useMutation({
    mutationFn: (id: string) => api.revokeAuthUserSessions(id),
    onSuccess: () => {
      setMessage('Сессии пользователя отозваны.');
      invalidate();
    },
  });

  const canSubmit = useMemo(
    () => form.email.trim() && form.displayName.trim() && form.password.length >= 10 && !createUser.isPending,
    [createUser.isPending, form],
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (!canSubmit) return;
    createUser.mutate();
  }

  if (currentUser?.role !== 'PLATFORM_ADMIN') {
    return (
      <Page title="Пользователи" description="Этот раздел доступен только владельцу системы.">
        <ErrorState text="Недостаточно прав." />
      </Page>
    );
  }

  return (
    <Page title="Пользователи" description="Своя авторизация: аккаунты, временные пароли, блокировка и отзыв сессий.">
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form onSubmit={submit} className="grid content-start gap-3 rounded-3xl border border-[var(--focus-border,var(--line))] bg-[var(--focus-surface,var(--panel))] p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-[var(--accent)]" />
            <h2 className="font-semibold">Новый пользователь</h2>
          </div>
          <input
            className="h-11 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 outline-none focus:border-[var(--accent)]"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <input
            className="h-11 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 outline-none focus:border-[var(--accent)]"
            placeholder="Имя"
            value={form.displayName}
            onChange={(event) => setForm({ ...form, displayName: event.target.value })}
          />
          <input
            className="h-11 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 outline-none focus:border-[var(--accent)]"
            placeholder="Временный пароль, минимум 10 символов"
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
          <select
            className="h-11 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 outline-none focus:border-[var(--accent)]"
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value as 'USER' | 'PLATFORM_ADMIN' })}
          >
            <option value="USER">Обычный пользователь</option>
            <option value="PLATFORM_ADMIN">Владелец / админ</option>
          </select>
          <button type="submit" disabled={!canSubmit} className="btn-base btn-primary h-11 disabled:opacity-50">
            Создать
          </button>
          {createUser.error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{createUser.error.message}</p> : null}
          {message ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
        </form>

        <section className="rounded-3xl border border-[var(--focus-border,var(--line))] bg-[var(--focus-surface,var(--panel))] p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-[var(--accent)]" />
              <h2 className="font-semibold">Аккаунты</h2>
            </div>
            <button type="button" onClick={() => users.refetch()} className="btn-base btn-secondary h-10">
              <RefreshCw size={16} />
              Обновить
            </button>
          </div>
          {users.isLoading ? <LoadingState text="Загружаю пользователей..." /> : null}
          {users.error ? <ErrorState text={users.error.message} /> : null}
          <div className="grid gap-3">
            {users.data?.map((user) => {
              const isCurrentUser = user.id === currentUser.id;
              const password = resetPassword[user.id] ?? '';
              return (
                <article key={user.id} className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{user.displayName ?? user.email ?? user.firstName}</h3>
                        <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                          {user.role === 'PLATFORM_ADMIN' ? 'Админ' : 'Пользователь'}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {user.status === 'ACTIVE' ? 'Активен' : 'Заблокирован'}
                        </span>
                        {user.mustChangePassword ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Нужна смена пароля</span> : null}
                      </div>
                      <p className="mt-1 text-sm text-[var(--muted)]">{user.email}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Web-сессий: {user._count?.authSessions ?? 0} · Mobile-сессий: {user._count?.mobileDeviceSessions ?? 0}
                        {user.lastLoginAt ? ` · Последний вход: ${new Date(user.lastLoginAt).toLocaleString('ru-RU')}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isCurrentUser || setUserStatus.isPending}
                        onClick={() => setUserStatus.mutate({ id: user.id, status: user.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE' })}
                        className="btn-base btn-secondary h-10 disabled:opacity-50"
                      >
                        {user.status === 'ACTIVE' ? <Lock size={16} /> : <ShieldCheck size={16} />}
                        {user.status === 'ACTIVE' ? 'Заблокировать' : 'Разблокировать'}
                      </button>
                      <button
                        type="button"
                        disabled={isCurrentUser || revokeSessions.isPending}
                        onClick={() => revokeSessions.mutate(user.id)}
                        className="btn-base btn-secondary h-10 disabled:opacity-50"
                      >
                        Сессии
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      className="h-10 flex-1 rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                      placeholder="Новый временный пароль"
                      type="password"
                      value={password}
                      onChange={(event) => setResetPassword((value) => ({ ...value, [user.id]: event.target.value }))}
                    />
                    <button
                      type="button"
                      disabled={password.length < 10 || resetUserPassword.isPending}
                      onClick={() => resetUserPassword.mutate({ id: user.id, password })}
                      className="btn-base btn-secondary h-10 disabled:opacity-50"
                    >
                      <KeyRound size={16} />
                      Сбросить пароль
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </Page>
  );
}
