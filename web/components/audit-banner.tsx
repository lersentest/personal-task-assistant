'use client';

import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';

export function AuditBanner() {
  const me = useQuery({
    queryKey: ['me'],
    queryFn: api.me,
    staleTime: 60_000,
    retry: false,
  });

  if (me.data?.sessionType !== 'AUDIT') return null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-[90] -translate-x-1/2 px-3">
      <div className="flex items-center gap-2 rounded-full border border-amber-300/70 bg-amber-50/95 px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-lg backdrop-blur dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-100">
        <ShieldCheck size={14} />
        Режим внешнего аудита
      </div>
    </div>
  );
}
