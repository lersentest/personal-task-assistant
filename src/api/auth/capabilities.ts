import { ForbiddenException } from '@nestjs/common';
import { CurrentUser } from '../current-user';

export function canUseDelegation(user: CurrentUser) {
  return user.role === 'PLATFORM_ADMIN';
}

export function assertCanUseDelegation(user: CurrentUser) {
  if (!canUseDelegation(user)) {
    throw new ForbiddenException('Delegation is unavailable for this account.');
  }
}
