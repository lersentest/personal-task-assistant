import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { addRequestTiming, setRequestUserId } from '../../observability/request-context';
import { AuthenticatedRequest } from '../current-user';
import { WebAuthService } from '../../auth/web-auth.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly auth: WebAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const startedAt = performance.now();
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    try {
      const token = this.extractToken(request.headers.authorization);
      if (!token) {
        throw new UnauthorizedException('Missing session');
      }

      const currentUser = await this.auth.authenticateAccessToken(token);
      request.user = currentUser;
      setRequestUserId(currentUser.id);
      return true;
    } finally {
      addRequestTiming('auth', performance.now() - startedAt);
    }
  }

  private extractToken(header: string | undefined): string | null {
    if (!header?.startsWith('Bearer ')) {
      return null;
    }
    return header.slice('Bearer '.length).trim();
  }
}
