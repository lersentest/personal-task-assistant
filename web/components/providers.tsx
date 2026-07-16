'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { markPerformance } from '@/lib/performance';
import { UiModeProvider } from './ui-mode-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 60_000,
            gcTime: 10 * 60_000,
            refetchOnWindowFocus: false,
            placeholderData: (previousData: unknown) => previousData,
          },
        },
      }),
    [],
  );

  useEffect(() => {
    markPerformance('app-navigation-start', true);
    const frame = requestAnimationFrame(() => {
      markPerformance('page-content-rendered', true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <UiModeProvider>{children}</UiModeProvider>
    </QueryClientProvider>
  );
}
