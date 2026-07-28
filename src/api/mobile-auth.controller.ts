import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { AuthenticatedRequest } from './current-user';
import { MobileAuthService } from '../mobile-auth/mobile-auth.service';

@Controller('api/mobile-auth')
@UseGuards(SupabaseAuthGuard)
export class MobileAuthController {
  constructor(private readonly mobileAuth: MobileAuthService) {}

  @Post('sessions')
  async createSession(
    @Req() request: AuthenticatedRequest,
    @Body()
    body: {
      deviceName?: string;
      platform?: 'ANDROID' | 'WEAR_OS';
    },
  ) {
    const deviceName = body.deviceName?.trim();
    if (!deviceName) {
      throw new BadRequestException('deviceName is required.');
    }
    const platform = body.platform ?? 'ANDROID';
    if (!['ANDROID', 'WEAR_OS'].includes(platform)) {
      throw new BadRequestException('Unsupported mobile platform.');
    }
    return this.mobileAuth.createDeviceSession({
      ownerId: request.user.id,
      deviceName,
      platform,
    });
  }

  @Delete('sessions/:id')
  revokeSession(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.mobileAuth.revoke(request.user.id, id);
  }
}
