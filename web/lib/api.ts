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

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error('NEXT_PUBLIC_API_URL is required');
}

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Сессия истекла');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function bearerHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Сессия истекла');
  return { Authorization: `Bearer ${token}` };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = await authHeaders();
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Не удалось выполнить запрос');
  }
  return response.json() as Promise<T>;
}

async function download(path: string): Promise<Blob> {
  const headers = await authHeaders();
  const response = await fetch(`${apiUrl}${path}`, { headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Не удалось скачать файл');
  }
  return response.blob();
}

async function formRequest<T>(path: string, formData: FormData): Promise<T> {
  const headers = await bearerHeader();
  const response = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Не удалось выполнить запрос');
  }
  return response.json() as Promise<T>;
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
