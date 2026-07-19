export interface CurrentUser {
  id: string;
  authUserId: string;
  email: string | null;
  timezone: string;
  sessionType?: 'OWNER' | 'AUDIT';
  auditSessionId?: string | null;
}

export interface AuthenticatedRequest {
  headers: {
    authorization?: string;
    cookie?: string;
  };
  user: CurrentUser;
}
