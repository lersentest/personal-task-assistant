import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHmac,
  createPublicKey,
  createVerify,
  JsonWebKey as CryptoJsonWebKey,
  timingSafeEqual,
} from 'crypto';
import { performance } from 'node:perf_hooks';
import { addRequestTiming, setRequestUserId } from '../../observability/request-context';
import { AuthenticatedRequest, CurrentUser } from '../current-user';
import { UsersService } from '../../users/users.service';

interface SupabaseJwtPayload {
  sub?: string;
  email?: string;
  exp?: number;
}

interface JwtHeader {
  alg?: string;
  kid?: string;
}

interface JsonWebKeySet {
  keys?: CryptoJsonWebKey[];
}

interface JwksVerifyAlgorithm {
  hash: string;
  dsaEncoding?: 'ieee-p1363';
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private jwksCache: { expiresAt: number; keys: CryptoJsonWebKey[] } | null =
    null;

  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const startedAt = performance.now();
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    try {
      const token = this.extractToken(request.headers.authorization);
      if (!token) {
        throw new UnauthorizedException('Missing session');
      }

      const payload = await this.verifyToken(token);
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

  private async verifyToken(token: string): Promise<SupabaseJwtPayload> {
    const parts = token.split('.');
    if (parts.length !== 3) throw new UnauthorizedException('Invalid token');
    const [header, payload, signature] = parts;

    const jwtHeader = this.decodeBase64Url<JwtHeader>(header);
    const hmacPayload = this.verifyLegacyHmacToken(
      jwtHeader,
      header,
      payload,
      signature,
    );
    if (hmacPayload) return hmacPayload;

    const jwksPayload = await this.verifyJwksToken(
      jwtHeader,
      header,
      payload,
      signature,
    );
    if (jwksPayload) return jwksPayload;

    throw new UnauthorizedException('Invalid token signature');
  }

  private verifyLegacyHmacToken(
    jwtHeader: JwtHeader,
    header: string,
    payload: string,
    signature: string,
  ): SupabaseJwtPayload | null {
    if (jwtHeader.alg !== 'HS256') return null;

    const secret = this.config.get<string>('SUPABASE_JWT_SECRET');
    if (!secret) return null;

    const expected = createHmac('sha256', secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    const received = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      received.length !== expectedBuffer.length ||
      !timingSafeEqual(received, expectedBuffer)
    ) {
      return null;
    }

    const decoded = this.decodeBase64Url<SupabaseJwtPayload>(payload);
    this.assertNotExpired(decoded);
    return decoded;
  }

  private async verifyJwksToken(
    jwtHeader: JwtHeader,
    header: string,
    payload: string,
    signature: string,
  ): Promise<SupabaseJwtPayload | null> {
    if (!jwtHeader.kid) return null;
    const algorithm = this.getJwksVerifyAlgorithm(jwtHeader.alg);
    if (!algorithm) return null;

    const keys = await this.getJwks();
    const jwk = keys.find((key) => key.kid === jwtHeader.kid);
    if (!jwk) return null;

    const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
    const verifier = createVerify(algorithm.hash);
    verifier.update(`${header}.${payload}`);
    verifier.end();

    const verifyKey = algorithm.dsaEncoding
      ? { key: publicKey, dsaEncoding: algorithm.dsaEncoding }
      : publicKey;
    const verified = verifier.verify(
      verifyKey,
      Buffer.from(signature, 'base64url'),
    );
    if (!verified) return null;

    const decoded = this.decodeBase64Url<SupabaseJwtPayload>(payload);
    this.assertNotExpired(decoded);
    return decoded;
  }

  private async getJwks(): Promise<CryptoJsonWebKey[]> {
    const now = Date.now();
    if (this.jwksCache && this.jwksCache.expiresAt > now) {
      return this.jwksCache.keys;
    }

    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    if (!supabaseUrl) throw new UnauthorizedException('Auth is not configured');

    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`,
    );
    if (!response.ok) {
      throw new UnauthorizedException('Unable to load auth keys');
    }

    const body = (await response.json()) as JsonWebKeySet;
    const keys = body.keys ?? [];
    this.jwksCache = {
      keys,
      expiresAt: now + 5 * 60 * 1000,
    };
    return keys;
  }

  private decodeBase64Url<T>(value: string): T {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
  }

  private getJwksVerifyAlgorithm(
    jwtAlgorithm: string | undefined,
  ): JwksVerifyAlgorithm | null {
    switch (jwtAlgorithm) {
      case 'RS256':
        return { hash: 'RSA-SHA256' };
      case 'ES256':
        return { hash: 'SHA256', dsaEncoding: 'ieee-p1363' };
      case 'ES384':
        return { hash: 'SHA384', dsaEncoding: 'ieee-p1363' };
      case 'ES512':
        return { hash: 'SHA512', dsaEncoding: 'ieee-p1363' };
      default:
        return null;
    }
  }

  private assertNotExpired(payload: SupabaseJwtPayload) {
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      throw new UnauthorizedException('Session expired');
    }
  }
}
