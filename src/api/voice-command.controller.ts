import {
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  MobileAuthenticatedRequest,
  MobileDeviceAuthGuard,
} from './auth/mobile-device-auth.guard';
import { MobileVoiceCommandService } from '../voice/mobile-voice-command.service';

type UploadedAudio = {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
  size: number;
};

@Controller('api/voice-command')
@UseGuards(MobileDeviceAuthGuard)
export class VoiceCommandController {
  constructor(private readonly voiceCommands: MobileVoiceCommandService) {}

  @Post('preview')
  @UseInterceptors(FileInterceptor('audio'))
  preview(
    @Req() request: MobileAuthenticatedRequest,
    @UploadedFile() file: UploadedAudio | undefined,
    @Body()
    body: {
      idempotencyKey?: string;
      clientCommandId?: string;
      source?: string;
      durationMs?: string;
      transcript?: string;
    },
  ) {
    return this.voiceCommands.preview(request.mobile, body, file);
  }

  @Post('confirm')
  confirm(
    @Req() request: MobileAuthenticatedRequest,
    @Body() body: { draftId?: string; idempotencyKey?: string },
  ) {
    return this.voiceCommands.confirm(request.mobile, body);
  }

  @Post('cancel')
  cancel(
    @Req() request: MobileAuthenticatedRequest,
    @Body() body: { draftId?: string; idempotencyKey?: string },
  ) {
    return this.voiceCommands.cancel(request.mobile, body);
  }
}
