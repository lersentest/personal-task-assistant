import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { AuthenticatedRequest, CurrentUser } from '../api/current-user';
import { PrismaService } from '../database/prisma.service';

export const AUDIT_COOKIE_NAME = 'pta_audit_session';
const ACCESS_TTL_MS = 72 * 60 * 60 * 1000;

interface AuditActivationResult {
  sessionToken: string;
  expiresAt: Date;
  user: CurrentUser;
}

@Injectable()
export class AuditAccessService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  isEnabled() {
    return this.config.get<string>('AUDIT_ACCESS_ENABLED') !== 'false';
  }

  generateToken() {
    return randomBytes(32).toString('base64url');
  }

  hashSecret(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  async activateToken(token: string): Promise<AuditActivationResult> {
    if (!this.isEnabled()) {
      throw new UnauthorizedException('Audit access is disabled');
    }

    const cleanToken = token.trim();
    if (cleanToken.length < 32) {
      throw new UnauthorizedException('Invalid audit access token');
    }

    const tokenHash = this.hashSecret(cleanToken);
    const now = new Date();
    const grant = await this.prisma.auditAccessGrant.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      include: { owner: true },
    });

    if (!grant) {
      throw new UnauthorizedException('Invalid audit access token');
    }

    const sessionToken = this.generateToken();
    const expiresAt = new Date(
      Math.min(grant.expiresAt.getTime(), now.getTime() + ACCESS_TTL_MS),
    );

    await this.prisma.$transaction([
      this.prisma.auditSession.updateMany({
        where: {
          ownerId: grant.ownerId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      }),
      this.prisma.auditSession.create({
        data: {
          grantId: grant.id,
          ownerId: grant.ownerId,
          sessionHash: this.hashSecret(sessionToken),
          expiresAt,
          lastSeenAt: now,
        },
      }),
    ]);

    return {
      sessionToken,
      expiresAt,
      user: this.toCurrentUser(grant.owner, null),
    };
  }

  async authenticateRequest(
    request: Pick<AuthenticatedRequest, 'headers'>,
  ): Promise<CurrentUser | null> {
    if (!this.isEnabled()) return null;

    const sessionToken = this.readCookie(
      request.headers.cookie,
      AUDIT_COOKIE_NAME,
    );
    if (!sessionToken) return null;

    const now = new Date();
    const session = await this.prisma.auditSession.findFirst({
      where: {
        sessionHash: this.hashSecret(sessionToken),
        revokedAt: null,
        expiresAt: { gt: now },
        grant: {
          revokedAt: null,
          expiresAt: { gt: now },
        },
      },
      include: { owner: true },
    });

    if (!session) return null;

    await this.prisma.auditSession.update({
      where: { id: session.id },
      data: { lastSeenAt: now },
    });

    return this.toCurrentUser(session.owner, session.id);
  }

  async revokeSessionFromCookie(cookieHeader?: string): Promise<void> {
    const sessionToken = this.readCookie(cookieHeader, AUDIT_COOKIE_NAME);
    if (!sessionToken) return;

    await this.prisma.auditSession.updateMany({
      where: {
        sessionHash: this.hashSecret(sessionToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  buildSessionCookie(sessionToken: string, expiresAt: Date) {
    const maxAgeSeconds = Math.max(
      0,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    );
    return [
      `${AUDIT_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`,
      'Path=/',
      `Max-Age=${maxAgeSeconds}`,
      'HttpOnly',
      'Secure',
      'SameSite=None',
    ].join('; ');
  }

  buildClearCookie() {
    return [
      `${AUDIT_COOKIE_NAME}=`,
      'Path=/',
      'Max-Age=0',
      'HttpOnly',
      'Secure',
      'SameSite=None',
    ].join('; ');
  }

  safeCompare(a: string, b: string) {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  private readCookie(cookieHeader: string | undefined, name: string) {
    if (!cookieHeader) return null;
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
      const [rawName, ...rawValue] = cookie.trim().split('=');
      if (rawName !== name) continue;
      return decodeURIComponent(rawValue.join('='));
    }
    return null;
  }

  private toCurrentUser(
    user: {
      id: string;
      authUserId: string | null;
      email?: string | null;
      timezone: string;
    },
    auditSessionId: string | null,
  ): CurrentUser {
    return {
      id: user.id,
      authUserId: user.authUserId ?? `audit:${user.id}`,
      email: user.email ?? null,
      timezone: user.timezone,
      sessionType: 'AUDIT',
      auditSessionId,
    };
  }
}
