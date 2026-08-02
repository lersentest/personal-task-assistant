'use client';

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error('NEXT_PUBLIC_API_URL is required');
}

const ACCESS_TOKEN_KEY = 'pta.accessToken';
const REFRESH_TOKEN_KEY = 'pta.refreshToken';
const USER_KEY = 'pta.user';

export type AuthUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  firstName: string;
  lastName: string | null;
  timezone: string;
  role: 'PLATFORM_ADMIN' | 'USER';
  status: 'ACTIVE' | 'BLOCKED' | 'DELETED';
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
};

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function getAccessToken() {
  if (!canUseStorage()) return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  if (!canUseStorage()) return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (!canUseStorage()) return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function storeAuth(response: AuthResponse) {
  localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(response.user));
  return response.user;
}

export function clearAuth() {
  if (!canUseStorage()) return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as { message?: string | string[]; error?: string };
      if (Array.isArray(parsed.message)) throw new Error(parsed.message.join(', '));
      throw new Error(parsed.message ?? parsed.error ?? text);
    } catch (error) {
      if (error instanceof Error && error.message !== text) throw error;
      throw new Error(text || 'Не удалось выполнить запрос');
    }
  }
  return response.json() as Promise<T>;
}

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export async function loginWithPassword(email: string, password: string) {
  const response = await fetch(`${apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, timezone: browserTimezone() }),
  });
  return storeAuth(await parseResponse<AuthResponse>(response));
}

export async function refreshAuthSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  const response = await fetch(`${apiUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken, timezone: browserTimezone() }),
  });
  if (!response.ok) {
    clearAuth();
    return null;
  }
  return storeAuth(await response.json() as AuthResponse);
}

export async function logout() {
  const refreshToken = getRefreshToken();
  clearAuth();
  if (!refreshToken) return;
  await fetch(`${apiUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  }).catch(() => undefined);
}
