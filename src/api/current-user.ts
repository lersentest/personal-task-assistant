export interface CurrentUser {
  id: string;
  authUserId: string;
  email: string | null;
  timezone: string;
}

export interface AuthenticatedRequest {
  headers: {
    authorization?: string;
  };
  user: CurrentUser;
}
