import { supabase } from './supabase';
import {
  Attachment,
  DashboardData,
  Project,
  ProjectInput,
  Task,
  TaskInput,
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
  search: () => request<{ tasks: Task[]; projects: Project[]; files: Attachment[] }>('/api/search'),
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
};
