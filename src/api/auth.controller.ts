import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { WebAuthService } from '../auth/web-auth.service';
import { MobileAuthService } from '../mobile-auth/mobile-auth.service';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { AuthenticatedRequest } from './current-user';

function requestMeta(request: { headers?: Record<string, string | string[] | undefined>; ip?: string }) {
  const header = request.headers ?? {};
  const userAgent = Array.isArray(header['user-agent']) ? header['user-agent'][0] : header['user-agent'];
  const forwarded = Array.isArray(header['x-forwarded-for']) ? header['x-forwarded-for'][0] : header['x-forwarded-for'];
  return {
    userAgent: userAgent ?? null,
    ipAddress: forwarded?.split(',')[0]?.trim() ?? request.ip ?? null,
  };
}

function requireAdmin(request: AuthenticatedRequest) {
  if (request.user.role !== 'PLATFORM_ADMIN') {
    throw new ForbiddenException('Admin access is required.');
  }
}

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly auth: WebAuthService,
    private readonly mobileAuth: MobileAuthService,
  ) {}

  @Post('login')
  login(
    @Body() body: { email?: string; password?: string; timezone?: string },
    @Req() request: { headers?: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    if (!body.email || !body.password) {
      throw new BadRequestException('Email and password are required.');
    }
    return this.auth.login({ email: body.email, password: body.password, timezone: body.timezone }, requestMeta(request));
  }

  @Post('refresh')
  refresh(
    @Body() body: { refreshToken?: string; timezone?: string },
    @Req() request: { headers?: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.auth.refresh(body.refreshToken, requestMeta(request), body.timezone);
  }

  @Post('logout')
  logout(@Body() body: { refreshToken?: string }) {
    return this.auth.logout(body.refreshToken);
  }

  @Post('change-password')
  @UseGuards(SupabaseAuthGuard)
  changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() body: { currentPassword?: string; newPassword?: string },
  ) {
    if (!body.newPassword) throw new BadRequestException('newPassword is required.');
    return this.auth.changePassword(request.user.id, body.currentPassword, body.newPassword);
  }

  @Get('users')
  @UseGuards(SupabaseAuthGuard)
  users(@Req() request: AuthenticatedRequest) {
    requireAdmin(request);
    return this.auth.listUsers();
  }

  @Post('users')
  @UseGuards(SupabaseAuthGuard)
  createUser(
    @Req() request: AuthenticatedRequest,
    @Body() body: { email?: string; displayName?: string; password?: string; role?: 'PLATFORM_ADMIN' | 'USER' },
  ) {
    requireAdmin(request);
    if (!body.email || !body.displayName || !body.password) {
      throw new BadRequestException('email, displayName and password are required.');
    }
    return this.auth.createUser({
      email: body.email,
      displayName: body.displayName,
      password: body.password,
      role: body.role ?? 'USER',
    });
  }

  @Post('users/:id/reset-password')
  @UseGuards(SupabaseAuthGuard)
  resetPassword(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { password?: string },
  ) {
    requireAdmin(request);
    if (!body.password) throw new BadRequestException('password is required.');
    return this.auth.resetUserPassword(id, body.password);
  }

  @Patch('users/:id/status')
  @UseGuards(SupabaseAuthGuard)
  setStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { status?: 'ACTIVE' | 'BLOCKED' },
  ) {
    requireAdmin(request);
    if (body.status !== 'ACTIVE' && body.status !== 'BLOCKED') {
      throw new BadRequestException('Unsupported status.');
    }
    if (request.user.id === id && body.status === 'BLOCKED') {
      throw new BadRequestException('You cannot block your own account.');
    }
    return this.auth.setUserStatus(id, body.status);
  }

  @Post('users/:id/revoke-sessions')
  @UseGuards(SupabaseAuthGuard)
  revokeUserSessions(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    requireAdmin(request);
    return this.auth.revokeUserSessions(id);
  }

  @Post('mobile-login')
  async mobileLogin(
    @Body()
    body: {
      email?: string;
      password?: string;
      deviceName?: string;
      platform?: 'ANDROID' | 'WEAR_OS';
    },
    @Req() request: { headers?: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    if (!body.email || !body.password) {
      throw new BadRequestException('Email and password are required.');
    }
    const login = await this.auth.login(
      { email: body.email, password: body.password },
      requestMeta(request),
    );
    if (login.user.mustChangePassword) {
      await this.auth.logout(login.refreshToken);
      throw new BadRequestException('Change password before connecting a mobile device.');
    }
    const deviceName = body.deviceName?.trim() || 'Android device';
    const session = await this.mobileAuth.createDeviceSession({
      ownerId: login.user.id,
      deviceName,
      platform: body.platform ?? 'ANDROID',
    });
    await this.auth.logout(login.refreshToken);
    return session;
  }
}
