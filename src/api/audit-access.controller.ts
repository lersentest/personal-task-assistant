import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuditAccessService } from '../audit-access/audit-access.service';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { AuthenticatedRequest } from './current-user';

interface CookieResponse {
  setHeader(name: string, value: string | string[]): void;
}

function readToken(body: unknown) {
  if (
    !body ||
    typeof body !== 'object' ||
    typeof (body as { token?: unknown }).token !== 'string'
  ) {
    throw new BadRequestException('Audit token is required');
  }
  return (body as { token: string }).token;
}

@Controller('api/audit')
export class AuditAccessController {
  constructor(private readonly auditAccess: AuditAccessService) {}

  @Post('access')
  async activate(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const result = await this.auditAccess.activateToken(readToken(body));
    response.setHeader(
      'Set-Cookie',
      this.auditAccess.buildSessionCookie(result.sessionToken, result.expiresAt),
    );
    return {
      ok: true,
      expiresAt: result.expiresAt.toISOString(),
      sessionType: result.user.sessionType,
      auditIndexUrl: '/audit-index',
    };
  }

  @Post('logout')
  @UseGuards(SupabaseAuthGuard)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    await this.auditAccess.revokeSessionFromCookie(request.headers.cookie);
    response.setHeader('Set-Cookie', this.auditAccess.buildClearCookie());
    return { ok: true };
  }
}
