import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestTimingEntry {
  name: string;
  durationMs: number;
}

export interface RequestContext {
  requestId: string;
  userId?: string;
  timings: RequestTimingEntry[];
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(
  context: RequestContext,
  callback: () => T,
): T {
  return storage.run(context, callback);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function setRequestUserId(userId: string | undefined): void {
  const context = getRequestContext();
  if (context && userId) {
    context.userId = userId;
  }
}

export function addRequestTiming(name: string, durationMs: number): void {
  const context = getRequestContext();
  if (!context) return;
  context.timings.push({
    name,
    durationMs: Math.max(0, Math.round(durationMs * 100) / 100),
  });
}

export function getRequestTimings(): RequestTimingEntry[] {
  return getRequestContext()?.timings ?? [];
}

export function getRequestId(): string | undefined {
  return getRequestContext()?.requestId;
}
