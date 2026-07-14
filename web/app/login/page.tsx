'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('vadim@instech.com.ua');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setMessage('Письмо для восстановления отправлено.');
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      router.replace('/dashboard');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-[420px] rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm text-[var(--muted)]">Personal Task Assistant</p>
          <h1 className="mt-2 text-2xl font-semibold">
            {mode === 'login' ? 'Вход' : 'Восстановление пароля'}
          </h1>
        </div>
        <label className="grid gap-2 text-sm">
          Email
          <input
            className="h-11 rounded-lg border border-[var(--line)] bg-transparent px-3 outline-none focus:border-[var(--accent)]"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
          />
        </label>
        {mode === 'login' ? (
          <label className="mt-4 grid gap-2 text-sm">
            Пароль
            <input
              className="h-11 rounded-lg border border-[var(--line)] bg-transparent px-3 outline-none focus:border-[var(--accent)]"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
            />
          </label>
        ) : null}
        {message ? <p className="mt-4 text-sm text-[var(--muted)]">{message}</p> : null}
        <button className="mt-6 h-11 w-full rounded-lg bg-[var(--foreground)] text-sm font-medium text-[var(--background)] disabled:opacity-60" disabled={loading}>
          {loading ? 'Подождите...' : mode === 'login' ? 'Войти' : 'Отправить письмо'}
        </button>
        <button
          type="button"
          className="mt-4 w-full text-sm text-[var(--muted)]"
          onClick={() => setMode(mode === 'login' ? 'reset' : 'login')}
        >
          {mode === 'login' ? 'Забыли пароль?' : 'Вернуться ко входу'}
        </button>
      </form>
    </main>
  );
}
