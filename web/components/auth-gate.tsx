'use client';

import { Session } from '@supabase/supabase-js';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type GateState =
  | { status: 'loading' }
  | { status: 'authenticated' }
  | { status: 'anonymous' };

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [gate, setGate] = useState<GateState>({ status: 'loading' });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    let cancelled = false;

    async function resolveAuthState() {
      if (session) {
        setGate({ status: 'authenticated' });
        if (pathname === '/login') router.replace('/dashboard');
        return;
      }

      if (cancelled) return;
      setGate({ status: 'anonymous' });
      if (pathname !== '/login') router.replace('/login');
    }

    resolveAuthState();
    return () => {
      cancelled = true;
    };
  }, [pathname, router, session]);

  if (session === undefined || gate.status === 'loading') {
    return <div className="grid min-h-screen place-items-center text-sm text-[var(--muted)]">Загрузка...</div>;
  }

  if (gate.status === 'anonymous' && pathname !== '/login') return null;
  return <>{children}</>;
}
