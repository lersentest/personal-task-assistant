'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { clearAuth, getAccessToken, getStoredUser, type AuthUser } from '@/lib/auth';

type GateState =
  | { status: 'loading'; user: null }
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'anonymous'; user: null };

const CurrentUserContext = createContext<AuthUser | null>(null);

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [gate, setGate] = useState<GateState>(() => {
    const stored = getStoredUser();
    return stored ? { status: 'authenticated', user: stored } : { status: 'loading', user: null };
  });

  useEffect(() => {
    let cancelled = false;

    async function resolveAuthState() {
      if (!getAccessToken()) {
        clearAuth();
        if (!cancelled) setGate({ status: 'anonymous', user: null });
        if (pathname !== '/login') router.replace('/login');
        return;
      }

      try {
        const user = await api.me();
        if (cancelled) return;
        setGate({ status: 'authenticated', user });
        if (pathname === '/login') {
          router.replace(user.mustChangePassword ? '/change-password' : '/dashboard');
        } else if (user.mustChangePassword && pathname !== '/change-password') {
          router.replace('/change-password');
        } else if (
          user.role !== 'PLATFORM_ADMIN' &&
          (pathname.startsWith('/delegated') || pathname.startsWith('/executors') || pathname.startsWith('/admin'))
        ) {
          router.replace('/dashboard');
        }
      } catch {
        clearAuth();
        if (cancelled) return;
        setGate({ status: 'anonymous', user: null });
        if (pathname !== '/login') router.replace('/login');
      }
    }

    resolveAuthState();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (gate.status === 'loading') {
    return <div className="grid min-h-screen place-items-center text-sm text-[var(--muted)]">Загрузка...</div>;
  }

  if (gate.status === 'anonymous' && pathname !== '/login') return null;
  return <CurrentUserContext.Provider value={gate.user}>{children}</CurrentUserContext.Provider>;
}
