import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { CurrentUser } from '../api/current-user';
import { PasswordService } from './password.service';

type JwtPayload = {
  typ: 'access';
  sub: string;
  sid: string;
  role: 'PLATFORM_ADMIN' | 'USER';
  authVersion: number;
  exp: number;
  iat: number;
};

type RequestMeta = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

type SafeUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  firstName: string;
  lastName: string | null;
  timezone: string;
  role: 'PLATFORM_ADMIN' | 'USER';
  status: 'ACTIVE' | 'BLOCKED' | 'DELETED';
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class WebAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  async login(input: { email: string; password: string }, meta: RequestMeta = {}) {
    const emailNormalized = this.normalizeEmail(input.email);
    const user = await this.prisma.user.findUnique({ where: { emailNormalized } });
    if (!user || user.deletedAt || user.status === 'DELETED') {
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (user.status === 'BLOCKED') {
      throw new ForbiddenException('User is blocked.');
    }

    await this.passwords.verifyPassword(input.password, user.passwordHash);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.createWebSession(user.id, meta);
  }

  async refresh(refreshToken: string | undefined, meta: RequestMeta = {}) {
    const token = refreshToken?.trim();
    if (!token) throw new UnauthorizedException('Refresh token is missing.');
    const sessionId = this.parseRefreshSessionId(token);
    const tokenHash = this.hashToken(token);
    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Session expired.');
    }
    if (session.refreshTokenHash.length !== tokenHash.length ||
      !timingSafeEqual(Buffer.from(session.refreshTokenHash), Buffer.from(tokenHash))) {
      throw new UnauthorizedException('Session expired.');
    }
    const user = session.user;
    if (user.deletedAt || user.status !== 'ACTIVE' || user.authVersion !== session.authVersion) {
      throw new UnauthorizedException('Session expired.');
    }

    const nextRefreshToken = this.makeRefreshToken(session.id);
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.hashToken(nextRefreshToken),
        userAgent: meta.userAgent ?? session.userAgent,
        ipAddress: meta.ipAddress ?? session.ipAddress,
        lastUsedAt: new Date(),
      },
    });

    return {
      accessToken: this.signAccessToken(user.id, session.id, user.role, user.authVersion),
      refreshToken: nextRefreshToken,
      user: this.toSafeUser(user),
    };
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return { ok: true };
    const sessionId = this.parseRefreshSessionId(refreshToken);
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async authenticateAccessToken(token: string): Promise<CurrentUser> {
    const payload = this.verifyAccessToken(token);
    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid },
      include: { user: { include: { workspaceMemberships: { take: 1 } } } },
    });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Session expired.');
    }
    const user = session.user;
    if (
      user.id !== payload.sub ||
      user.authVersion !== payload.authVersion ||
      session.authVersion !== user.authVersion ||
      user.status !== 'ACTIVE' ||
      user.deletedAt
    ) {
      throw new UnauthorizedException('Session expired.');
    }
    return {
      id: user.id,
      authUserId: user.id,
      email: user.email,
      displayName: user.displayName,
      timezone: user.timezone,
      role: user.role,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      workspaceId: user.workspaceMemberships[0]?.workspaceId ?? null,
      sessionId: session.id,
      authVersion: user.authVersion,
    };
  }

  async changePassword(userId: string, currentPassword: string | undefined, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new UnauthorizedException('User not found.');
    if (user.passwordHash && !user.mustChangePassword) {
      await this.passwords.verifyPassword(currentPassword ?? '', user.passwordHash);
    }
    const passwordHash = await this.passwords.hashPassword(newPassword);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        authVersion: { increment: 1 },
      },
    });
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return this.toSafeUser(updated);
  }

  async listUsers() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        email: true,
        displayName: true,
        firstName: true,
        lastName: true,
        timezone: true,
        role: true,
        status: true,
        mustChangePassword: true,
        lastLoginAt: true,
        createdAt: true,
        _count: { select: { authSessions: true, mobileDeviceSessions: true } },
      },
    });
    return users;
  }

  async createUser(input: {
    email: string;
    displayName: string;
    password: string;
    role?: 'PLATFORM_ADMIN' | 'USER';
    timezone?: string;
  }) {
    const emailNormalized = this.normalizeEmail(input.email);
    const passwordHash = await this.passwords.hashPassword(input.password);
    const displayName = input.displayName.trim() || emailNormalized;
    const firstName = displayName.split(/\s+/)[0] ?? emailNormalized;
    const user = await this.prisma.user.create({
      data: {
        telegramId: await this.nextSyntheticTelegramId(),
        email: input.email.trim(),
        emailNormalized,
        displayName,
        firstName,
        timezone: input.timezone ?? this.config.get<string>('APP_TIMEZONE') ?? 'Europe/Zurich',
        passwordHash,
        role: input.role ?? 'USER',
        status: 'ACTIVE',
        mustChangePassword: true,
      },
    });
    await this.ensureWorkspace(user.id, displayName);
    return this.toSafeUser(user);
  }

  async resetUserPassword(userId: string, password: string) {
    const passwordHash = await this.passwords.hashPassword(password);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: true,
        authVersion: { increment: 1 },
      },
    });
    await this.revokeUserSessions(userId);
    return this.toSafeUser(user);
  }

  async setUserStatus(userId: string, status: 'ACTIVE' | 'BLOCKED') {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        status,
        blockedAt: status === 'BLOCKED' ? new Date() : null,
        authVersion: { increment: 1 },
      },
    });
    if (status === 'BLOCKED') await this.revokeUserSessions(userId);
    return this.toSafeUser(user);
  }

  async revokeUserSessions(userId: string) {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async createWebSession(userId: string, meta: RequestMeta = {}) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE' || user.deletedAt) {
      throw new UnauthorizedException('User not found.');
    }
    await this.ensureWorkspace(user.id, user.displayName ?? user.email ?? user.firstName);
    const sessionId = randomUUID();
    const refreshToken = this.makeRefreshToken(sessionId);
    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        sessionType: 'WEB',
        refreshTokenHash: this.hashToken(refreshToken),
        userAgent: meta.userAgent ?? null,
        ipAddress: meta.ipAddress ?? null,
        authVersion: user.authVersion,
        expiresAt: new Date(Date.now() + this.refreshTtlDays() * 24 * 60 * 60 * 1000),
      },
    });
    return {
      accessToken: this.signAccessToken(user.id, sessionId, user.role, user.authVersion),
      refreshToken,
      user: this.toSafeUser(user),
    };
  }

  private async ensureWorkspace(userId: string, name: string) {
    const existing = await this.prisma.workspaceMember.findFirst({ where: { userId } });
    if (existing) return existing.workspaceId;
    const workspace = await this.prisma.workspace.create({
      data: {
        ownerUserId: userId,
        name: name || 'Workspace',
        members: { create: { userId, role: 'OWNER' } },
      },
    });
    return workspace.id;
  }

  private async nextSyntheticTelegramId() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const value = BigInt(-1_000_000_000 - Math.floor(Math.random() * 1_000_000_000));
      const existing = await this.prisma.user.findUnique({ where: { telegramId: value } });
      if (!existing) return value;
    }
    throw new BadRequestException('Unable to allocate user id.');
  }

  private toSafeUser(user: SafeUser) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      firstName: user.firstName,
      lastName: user.lastName,
      timezone: user.timezone,
      role: user.role,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  private signAccessToken(
    userId: string,
    sessionId: string,
    role: 'PLATFORM_ADMIN' | 'USER',
    authVersion: number,
  ) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const payload: JwtPayload = {
      typ: 'access',
      sub: userId,
      sid: sessionId,
      role,
      authVersion,
      iat: nowSeconds,
      exp: nowSeconds + this.accessTtlMinutes() * 60,
    };
    const header = this.base64UrlJson({ alg: 'HS256', typ: 'JWT' });
    const body = this.base64UrlJson(payload);
    const signature = createHmac('sha256', this.jwtSecret())
      .update(`${header}.${body}`)
      .digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  private verifyAccessToken(token: string): JwtPayload {
    const parts = token.split('.');
    if (parts.length !== 3) throw new UnauthorizedException('Invalid token.');
    const [header, body, signature] = parts;
    const expected = createHmac('sha256', this.jwtSecret())
      .update(`${header}.${body}`)
      .digest('base64url');
    if (expected.length !== signature.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      throw new UnauthorizedException('Invalid token.');
    }
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as JwtPayload;
    if (payload.typ !== 'access' || payload.exp * 1000 <= Date.now()) {
      throw new UnauthorizedException('Session expired.');
    }
    return payload;
  }

  private makeRefreshToken(sessionId: string) {
    return `ptr_${sessionId}_${randomBytes(32).toString('base64url')}`;
  }

  private parseRefreshSessionId(token: string) {
    const [, sessionId] = token.split('_');
    if (!sessionId) throw new UnauthorizedException('Session expired.');
    return sessionId;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private base64UrlJson(value: unknown) {
    return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  }

  private jwtSecret() {
    return (
      this.config.get<string>('AUTH_JWT_SECRET') ||
      this.config.get<string>('TELEGRAM_BOT_TOKEN') ||
      this.config.get<string>('DATABASE_URL') ||
      'development-only-auth-secret'
    );
  }

  private accessTtlMinutes() {
    const value = Number(this.config.get<string>('AUTH_ACCESS_TOKEN_TTL_MINUTES'));
    return Number.isFinite(value) ? Math.min(60, Math.max(5, Math.floor(value))) : 15;
  }

  private refreshTtlDays() {
    const value = Number(this.config.get<string>('AUTH_REFRESH_TOKEN_TTL_DAYS'));
    return Number.isFinite(value) ? Math.min(180, Math.max(1, Math.floor(value))) : 45;
  }
}
