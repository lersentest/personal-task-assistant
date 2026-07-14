import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { AuthenticatedRequest, CurrentUser } from '../current-user';
import { UsersService } from '../../users/users.service';

interface SupabaseJwtPayload {
  sub?: string;
  email?: string;
  exp?: number;
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request.headers.authorization);
    const payload = this.verifyToken(token);
    if (!payload.sub) throw new UnauthorizedException('Invalid session');

    const telegramOwnerId = this.config.getOrThrow<string>(
      'ALLOWED_TELEGRAM_USER_ID',
    );
    const user = await this.users.linkAuthUserToTelegramOwner(
      payload.sub,
      telegramOwnerId,
    );
    if (!user) {
      throw new UnauthorizedException(
        'Telegram owner must start the bot before web login can be used',
      );
    }

    const currentUser: CurrentUser = {
      id: user.id,
      authUserId: payload.sub,
      email: payload.email ?? null,
      timezone: user.timezone,
    };
    request.user = currentUser;
    return true;
  }

  private extractToken(header: string | undefined): string {
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    return header.slice('Bearer '.length).trim();
  }

  private verifyToken(token: string): SupabaseJwtPayload {
    const secret = this.config.get<string>('SUPABASE_JWT_SECRET');
    if (!secret) throw new UnauthorizedException('Auth is not configured');

    const parts = token.split('.');
    if (parts.length !== 3) throw new UnauthorizedException('Invalid token');
    const [header, payload, signature] = parts;
    const expected = createHmac('sha256', secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      throw new UnauthorizedException('Invalid token signature');
    }

    const decoded = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as SupabaseJwtPayload;
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      throw new UnauthorizedException('Session expired');
    }
    return decoded;
  }
}

