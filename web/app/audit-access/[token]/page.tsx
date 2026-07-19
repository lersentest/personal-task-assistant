'use client';

import { useMutation } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { api } from '@/lib/api';

export default function AuditAccessPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  const activation = useMutation({
    mutationFn: () => api.activateAuditAccess(token),
    onSuccess: () => {
      router.replace('/my-day');
    },
  });

  useEffect(() => {
    if (!token || activation.isPending || activation.isSuccess) return;
    activation.mutate();
  }, [activation.isPending, activation.isSuccess, activation.mutate, token]);

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--focus-bg)] px-4 text-[var(--focus-text)]">
      <section className="w-full max-w-md rounded-[28px] border border-[var(--focus-border)] bg-[var(--focus-surface)] p-8 text-center shadow-[var(--focus-shadow)]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--focus-primary-soft)] text-[var(--focus-primary)]">
          <ShieldCheck size={26} />
        </div>
        <h1 className="text-2xl font-semibold">Временный аудит</h1>
        <p className="mt-2 text-sm text-[var(--focus-text-muted)]">
          {activation.isError
            ? 'Ссылка недействительна, отключена или срок доступа уже истёк.'
            : 'Проверяю ссылку и открываю систему без логина и пароля.'}
        </p>
        {activation.isError ? (
          <button
            type="button"
            onClick={() => router.replace('/login')}
            className="mt-6 rounded-2xl bg-[var(--focus-primary)] px-5 py-3 text-sm font-semibold text-white"
          >
            Перейти ко входу
          </button>
        ) : (
          <div className="mx-auto mt-6 h-2 w-36 overflow-hidden rounded-full bg-[var(--focus-surface-secondary)]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--focus-primary)]" />
          </div>
        )}
      </section>
    </main>
  );
}
