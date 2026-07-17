import { supabase } from './supabase';
import {
  Attachment,
  ConfirmedVoiceOperation,
  DashboardData,
  DailyPlanItem,
  DelegatedTask,
  DelegatedTaskInput,
  Executor,
  ExecutorInput,
  MyDayData,
  Project,
  ProjectInput,
  Task,
  TaskInput,
  VoiceInterpretation,
} from './types';
import {
  createRequestId,
  markPerformance,
  measurePerformance,
} from './performance';

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error('NEXT_PUBLIC_API_URL is required');
}

let cachedAccessToken: { token: string; expiresAtMs: number } | null = null;
let authCacheSubscriptionStarted = false;

function ensureAuthCacheSubscription() {
  if (authCacheSubscriptionStarted || typeof window === 'undefined') return;
  authCacheSubscriptionStarted = true;
  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session?.access_token) {
      cachedAccessToken = null;
      return;
    }
    cachedAccessToken = {
      token: session.access_token,
      expiresAtMs: session.expires_at
        ? session.expires_at * 1000
        : Date.now() + 60_000,
    };
  });
}

async function getAccessToken() {
  ensureAuthCacheSubscription();
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAtMs > now + 30_000) {
    markPerformance('auth-ready', true);
    return cachedAccessToken.token;
  }

  const { data } = await supabase.auth.getSession();
  const session = data.session;
  const token = session?.access_token;
  if (!token) throw new Error('Сессия истекла');

  cachedAccessToken = {
    token,
    expiresAtMs: session.expires_at
      ? session.expires_at * 1000
      : now + 60_000,
  };
  markPerformance('auth-ready', true);
  return token;
}

async function authHeaders() {
  const token = await getAccessToken();
  if (!token) throw new Error('Сессия истекла');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function bearerHeader() {
  const token = await getAccessToken();
  if (!token) throw new Error('Сессия истекла');
  return { Authorization: `Bearer ${token}`, 'X-Request-Id': createRequestId() };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const requestId = createRequestId();
  const method = init.method ?? 'GET';
  const markPrefix = `api:${method}:${path}:${requestId}`;
  markPerformance('initial-data-request-start', true);
  markPerformance(`${markPrefix}:start`);
  const headers = await authHeaders();
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        ...headers,
        'X-Request-Id': requestId,
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(extractErrorMessage(text));
    }
    return response.json() as Promise<T>;
  } finally {
    markPerformance(`${markPrefix}:end`);
    markPerformance('initial-data-request-end', true);
    measurePerformance(`api ${method} ${path}`, `${markPrefix}:start`, `${markPrefix}:end`);
  }
}

async function publicRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const requestId = createRequestId();
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(extractErrorMessage(text));
  }
  return response.json() as Promise<T>;
}

async function download(path: string): Promise<Blob> {
  const headers = await authHeaders();
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { ...headers, 'X-Request-Id': createRequestId() },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(extractErrorMessage(text, 'Не удалось скачать файл'));
  }
  return response.blob();
}

async function publicDownload(path: string): Promise<Blob> {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { 'X-Request-Id': createRequestId() },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(extractErrorMessage(text, 'Не удалось скачать файл'));
  }
  return response.blob();
}

async function formRequest<T>(path: string, formData: FormData): Promise<T> {
  const headers = await bearerHeader();
  const response = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: { ...headers, 'X-Request-Id': createRequestId() },
    body: formData,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(extractErrorMessage(text));
  }
  return response.json() as Promise<T>;
}

function extractErrorMessage(text: string, fallback = 'Не удалось выполнить запрос') {
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text) as { message?: string | string[]; error?: string };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    if (parsed.message) return parsed.message;
    if (parsed.error) return parsed.error;
  } catch {
    // API can return plain text for proxy/deployment errors.
  }
  return text;
}

export const api = {
  me: () => request<{ id: string; email: string | null; timezone: string }>('/api/me'),
  dashboard: () => request<DashboardData>('/api/dashboard'),
  tasks: (query = '') => request<Task[]>(`/api/tasks${query}`),
  task: (id: string) => request<Task>(`/api/tasks/${id}`),
  createTask: (input: TaskInput) =>
    request<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(input) }),
  updateTask: (id: string, input: Partial<TaskInput>) =>
    request<Task>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  completeTask: (id: string) =>
    request<Task>(`/api/tasks/${id}/complete`, { method: 'POST' }),
  restoreTask: (id: string) =>
    request<Task>(`/api/tasks/${id}/restore`, { method: 'POST' }),
  deleteTask: (id: string) =>
    request<{ ok: true }>(`/api/tasks/${id}`, { method: 'DELETE' }),
  createTaskChecklistItem: (taskId: string, title: string) =>
    request<Task>(`/api/tasks/${taskId}/checklist-items`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
  updateTaskChecklistItem: (
    taskId: string,
    itemId: string,
    input: { title?: string; isCompleted?: boolean },
  ) =>
    request<Task>(`/api/tasks/${taskId}/checklist-items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  deleteTaskChecklistItem: (taskId: string, itemId: string) =>
    request<Task>(`/api/tasks/${taskId}/checklist-items/${itemId}`, {
      method: 'DELETE',
    }),
  reorderTaskChecklistItems: (taskId: string, itemIds: string[]) =>
    request<Task>(`/api/tasks/${taskId}/checklist-items/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ itemIds }),
    }),
  executors: () => request<Executor[]>('/api/executors'),
  executor: (id: string) => request<Executor>(`/api/executors/${id}`),
  createExecutor: (input: ExecutorInput) =>
    request<Executor>('/api/executors', { method: 'POST', body: JSON.stringify(input) }),
  updateExecutor: (id: string, input: Partial<ExecutorInput>) =>
    request<Executor>(`/api/executors/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteExecutor: (id: string) =>
    request<{ ok: true }>(`/api/executors/${id}`, { method: 'DELETE' }),
  inviteExecutor: (id: string) =>
    request<{ token: string; link: string; expiresAt: string }>(`/api/executors/${id}/invite`, { method: 'POST' }),
  regenerateExecutorInvite: (id: string) =>
    request<{ token: string; link: string; expiresAt: string }>(`/api/executors/${id}/invite/regenerate`, { method: 'POST' }),
  revokeExecutorInvite: (id: string) =>
    request<{ ok: true }>(`/api/executors/${id}/invite/revoke`, { method: 'POST' }),
  delegatedTasks: (query = '') => request<DelegatedTask[]>(`/api/delegated-tasks${query}`),
  delegatedTask: (id: string) => request<DelegatedTask>(`/api/delegated-tasks/${id}`),
  delegatedTaskPublicLink: (id: string) =>
    request<{ token: string; url: string; revokedAt: string | null }>(`/api/delegated-tasks/${id}/public-link`),
  regenerateDelegatedTaskPublicLink: (id: string) =>
    request<{ token: string; url: string; revokedAt: string | null }>(`/api/delegated-tasks/${id}/public-link/regenerate`, { method: 'POST' }),
  revokeDelegatedTaskPublicLink: (id: string) =>
    request<{ ok: true }>(`/api/delegated-tasks/${id}/public-link/revoke`, { method: 'POST' }),
  createDelegatedTask: (input: DelegatedTaskInput) =>
    request<DelegatedTask>('/api/delegated-tasks', { method: 'POST', body: JSON.stringify(input) }),
  updateDelegatedTask: (id: string, input: Partial<DelegatedTaskInput> & { status?: string; resultText?: string | null }) =>
    request<DelegatedTask>(`/api/delegated-tasks/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteDelegatedTask: (id: string) =>
    request<{ ok: true }>(`/api/delegated-tasks/${id}`, { method: 'DELETE' }),
  sendDelegatedTask: (id: string) =>
    request<DelegatedTask>(`/api/delegated-tasks/${id}/send`, { method: 'POST' }),
  remindDelegatedTask: (id: string) =>
    request<DelegatedTask>(`/api/delegated-tasks/${id}/remind`, { method: 'POST' }),
  cancelDelegatedTask: (id: string) =>
    request<DelegatedTask>(`/api/delegated-tasks/${id}/cancel`, { method: 'POST' }),
  acceptDelegatedTask: (id: string, message?: string) =>
    request<DelegatedTask>(`/api/delegated-tasks/${id}/review/accept`, { method: 'POST', body: JSON.stringify({ message }) }),
  returnDelegatedTask: (id: string, message?: string) =>
    request<DelegatedTask>(`/api/delegated-tasks/${id}/review/return`, { method: 'POST', body: JSON.stringify({ message }) }),
  commentDelegatedTask: (id: string, message: string) =>
    request<DelegatedTask>(`/api/delegated-tasks/${id}/comments`, { method: 'POST', body: JSON.stringify({ message }) }),
  projects: () => request<Project[]>('/api/projects'),
  project: (id: string) => request<Project>(`/api/projects/${id}`),
  createProject: (input: ProjectInput) =>
    request<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateProject: (id: string, input: Partial<ProjectInput>) =>
    request<Project>(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  calendar: () => request<Task[]>('/api/calendar'),
  search: (query = '') => request<{ tasks: Task[]; delegatedTasks: DelegatedTask[]; projects: Project[]; files: Attachment[] }>(`/api/search${query}`),
  attachments: (query = '') => request<Attachment[]>(`/api/attachments${query}`),
  createAttachment: (input: {
    taskId?: string | null;
    projectId?: string | null;
    delegatedTaskId?: string | null;
    fileName: string;
    mimeType: string;
    dataBase64: string;
  }) =>
    request<Attachment>('/api/attachments', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  downloadAttachment: (id: string) =>
    download(`/api/attachments/${id}/download`),
  deleteAttachment: (id: string) =>
    request<{ ok: true }>(`/api/attachments/${id}`, { method: 'DELETE' }),
  publicDelegatedTask: (token: string) =>
    publicRequest<DelegatedTask>(`/api/public/delegated-tasks/${token}`),
  publicDelegatedTaskAction: (token: string, input: { action: 'accept' | 'start' | 'question' | 'done'; message?: string | null }) =>
    publicRequest<DelegatedTask>(`/api/public/delegated-tasks/${token}/actions`, { method: 'POST', body: JSON.stringify(input) }),
  publicDelegatedTaskComment: (token: string, message: string) =>
    publicRequest<DelegatedTask>(`/api/public/delegated-tasks/${token}/comments`, { method: 'POST', body: JSON.stringify({ message }) }),
  publicDelegatedTaskAttachment: (token: string, input: { fileName: string; mimeType: string; dataBase64: string }) =>
    publicRequest<Attachment>(`/api/public/delegated-tasks/${token}/attachments`, { method: 'POST', body: JSON.stringify(input) }),
  publicDelegatedTaskDownloadAttachment: (token: string, id: string) =>
    publicDownload(`/api/public/delegated-tasks/${token}/attachments/${id}/download`),
  myDay: (date: string) => request<MyDayData>(`/api/my-day?date=${date}`),
  myDaySuggestions: (query: string) =>
    request<Task[]>(`/api/my-day/suggestions${query}`),
  addMyDayItem: (input: {
    taskId: string;
    date: string;
    scheduledStartAt?: string | null;
    scheduledEndAt?: string | null;
    estimatedDurationMinutes?: number | null;
  }) =>
    request<DailyPlanItem>('/api/my-day/items', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateMyDayItem: (id: string, input: {
    date?: string;
    order?: number;
    scheduledStartAt?: string | null;
    scheduledEndAt?: string | null;
    estimatedDurationMinutes?: number | null;
  }) =>
    request<DailyPlanItem>(`/api/my-day/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  removeMyDayItem: (id: string) =>
    request<{ ok: true }>(`/api/my-day/items/${id}`, { method: 'DELETE' }),
  scheduleMyDayItem: (id: string, input: {
    scheduledStartAt: string;
    scheduledEndAt: string;
    estimatedDurationMinutes?: number | null;
  }) =>
    request<DailyPlanItem>(`/api/my-day/items/${id}/schedule`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  unscheduleMyDayItem: (id: string) =>
    request<DailyPlanItem>(`/api/my-day/items/${id}/unschedule`, { method: 'POST' }),
  completeMyDayItem: (id: string) =>
    request<DailyPlanItem>(`/api/my-day/items/${id}/complete`, { method: 'POST' }),
  reorderMyDayItems: (input: { date: string; itemIds: string[] }) =>
    request<{ ok: true }>('/api/my-day/items/reorder', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  completeMyDay: (input: {
    date: string;
    actions: Array<{
      itemId: string;
      action: 'TOMORROW' | 'BACKLOG' | 'KEEP' | 'CANCEL';
      date?: string;
    }>;
  }) =>
    request<MyDayData>('/api/my-day/complete', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  transcribeVoice: (input: { audio: Blob; mimeType: string; durationMs: number }) => {
    const formData = new FormData();
    formData.append('audio', input.audio, 'web-voice');
    formData.append('mimeType', input.mimeType);
    formData.append('durationMs', String(input.durationMs));
    return formRequest<{ transcript: string; durationMs: number }>('/api/voice/transcribe', formData);
  },
  interpretVoice: (transcript: string) =>
    request<VoiceInterpretation>('/api/voice/interpret', {
      method: 'POST',
      body: JSON.stringify({ transcript }),
    }),
  confirmVoiceDraft: (draftId: string) =>
    request<ConfirmedVoiceOperation>(`/api/voice/drafts/${draftId}/confirm`, {
      method: 'POST',
    }),
  cancelVoiceDraft: (draftId: string) =>
    request<{ ok: true }>(`/api/voice/drafts/${draftId}/cancel`, {
      method: 'POST',
    }),
};
