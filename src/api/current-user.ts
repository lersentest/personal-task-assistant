export interface CurrentUser {
  id: string;
  authUserId: string;
  email: string | null;
  displayName: string | null;
  timezone: string;
  role: 'PLATFORM_ADMIN' | 'USER';
  status: 'ACTIVE' | 'BLOCKED' | 'DELETED';
  mustChangePassword: boolean;
  workspaceId: string | null;
  sessionId: string;
  authVersion: number;
}

export interface AuthenticatedRequest {
  headers: {
    authorization?: string;
  };
  user: CurrentUser;
}
