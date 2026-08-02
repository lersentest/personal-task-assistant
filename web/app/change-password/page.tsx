'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { clearAuth } from '@/lib/auth';
import { useCurrentUser } from '@/components/auth-gate';

export default function ChangePasswordPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    if (newPassword !== repeatPassword) {
      setMessage('Пароли не совпадают.');
      return;
    }
    setLoading(true);
    try {
      await api.changePassword({
        currentPassword: user?.mustChangePassword ? undefined : currentPassword,
        newPassword,
      });
      clearAuth();
      router.replace('/login');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось сменить пароль');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--focus-bg,var(--background))] px-4">
      <form onSubmit={submit} className="w-full max-w-[460px] rounded-[28px] border border-[var(--line)] bg-[var(--panel)] p-7 shadow-[var(--focus-shadow)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Personal Tasks</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Сменить пароль</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {user?.mustChangePassword ? 'Это временный пароль. Задай постоянный пароль перед работой.' : 'Обнови пароль для текущего аккаунта.'}
        </p>
        {!user?.mustChangePassword ? (
          <label className="mt-6 grid gap-2 text-sm font-medium">
            Текущий пароль
            <input className="h-12 rounded-2xl border border-[var(--line)] bg-transparent px-4 outline-none focus:border-[var(--accent)]" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          </label>
        ) : null}
        <label className="mt-6 grid gap-2 text-sm font-medium">
          Новый пароль
          <input className="h-12 rounded-2xl border border-[var(--line)] bg-transparent px-4 outline-none focus:border-[var(--accent)]" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={10} required autoFocus />
        </label>
        <label className="mt-4 grid gap-2 text-sm font-medium">
          Повтори пароль
          <input className="h-12 rounded-2xl border border-[var(--line)] bg-transparent px-4 outline-none focus:border-[var(--accent)]" type="password" value={repeatPassword} onChange={(event) => setRepeatPassword(event.target.value)} minLength={10} required />
        </label>
        {message ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p> : null}
        <button className="mt-6 h-12 w-full rounded-2xl bg-[var(--foreground)] text-sm font-semibold text-[var(--background)] disabled:opacity-60" disabled={loading}>
          {loading ? 'Сохраняю...' : 'Сохранить пароль'}
        </button>
      </form>
    </main>
  );
}
