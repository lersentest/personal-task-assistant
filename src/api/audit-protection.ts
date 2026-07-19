import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedRequest } from './current-user';

const AUDIT_FORBIDDEN_MESSAGE =
  'Это действие недоступно во временном режиме аудита.';

export function assertNotAuditSession(request: AuthenticatedRequest) {
  if (request.user.sessionType === 'AUDIT') {
    throw new ForbiddenException(AUDIT_FORBIDDEN_MESSAGE);
  }
}
