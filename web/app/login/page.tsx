'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { loginWithPassword } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
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
            name="email"
            autoComplete="email"
            required
            autoFocus
          />
        </label>
        <label className="mt-4 grid gap-2 text-sm font-medium">
          Пароль
          <span className="relative">
            <input
              className="h-12 w-full rounded-2xl border border-[var(--line)] bg-transparent px-4 pr-12 outline-none transition focus:border-[var(--accent)]"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type={passwordVisible ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setPasswordVisible((value) => !value)}
              className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--focus-surface-secondary,var(--line))] hover:text-[var(--foreground)]"
              aria-label={passwordVisible ? 'Скрыть пароль' : 'Показать пароль'}
            >
              {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        {message ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p> : null}
        <button className="mt-6 h-12 w-full rounded-2xl bg-[var(--foreground)] text-sm font-semibold text-[var(--background)] transition hover:opacity-90 disabled:opacity-60" disabled={loading}>
          {loading ? 'Проверяю...' : 'Войти'}
        </button>
      </form>
    </main>
  );
}
