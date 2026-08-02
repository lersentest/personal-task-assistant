'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginWithPassword } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('vadim@instech.com.ua');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const user = await loginWithPassword(email, password);
      router.replace(user.mustChangePassword ? '/change-password' : '/dashboard');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--focus-bg,var(--background))] px-4">
      <form onSubmit={submit} className="w-full max-w-[430px] rounded-[28px] border border-[var(--line)] bg-[var(--panel)] p-7 shadow-[var(--focus-shadow)]">
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Personal Tasks</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Вход</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Войди в свой рабочий аккаунт.</p>
        </div>
        <label className="grid gap-2 text-sm font-medium">
          Email
          <input
            className="h-12 rounded-2xl border border-[var(--line)] bg-transparent px-4 outline-none transition focus:border-[var(--accent)]"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
          />
        </label>
        <label className="mt-4 grid gap-2 text-sm font-medium">
          Пароль
          <input
            className="h-12 rounded-2xl border border-[var(--line)] bg-transparent px-4 outline-none transition focus:border-[var(--accent)]"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            required
            autoFocus
          />
        </label>
        {message ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p> : null}
        <button className="mt-6 h-12 w-full rounded-2xl bg-[var(--foreground)] text-sm font-semibold text-[var(--background)] transition hover:opacity-90 disabled:opacity-60" disabled={loading}>
          {loading ? 'Проверяю...' : 'Войти'}
        </button>
      </form>
    </main>
  );
}
