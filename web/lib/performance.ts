const markedOnce = new Set<string>();

function getPerformance(): Performance | null {
  if (typeof window === 'undefined') return null;
  return window.performance ?? null;
}

export function markPerformance(name: string, once = false): void {
  const perf = getPerformance();
  if (!perf) return;
  if (once && markedOnce.has(name)) return;
  markedOnce.add(name);
  perf.mark(name);
}

export function measurePerformance(name: string, start: string, end: string): void {
  const perf = getPerformance();
  if (!perf) return;
  try {
    perf.measure(name, start, end);
  } catch {
    // Diagnostic marks must never break user actions.
  }
}

export function createRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
