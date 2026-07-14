import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  Logger,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { AuthenticatedRequest } from './current-user';
import { AiCommandService } from '../ai/ai-command.service';
import { VoiceCommandService } from '../voice/voice-command.service';

type UploadedAudio = {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
  size: number;
};

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const MAX_DURATION_MS = 5 * 60 * 1000;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 1000;
const SUPPORTED_AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/x-m4a',
  'video/webm',
  'video/mp4',
]);

@Controller('api/voice')
@UseGuards(SupabaseAuthGuard)
export class VoiceController {
  private readonly logger = new Logger(VoiceController.name);
  private readonly rateLimit = new Map<string, number[]>();

  constructor(
    private readonly ai: AiCommandService,
    private readonly voiceCommands: VoiceCommandService,
  ) {}

  @Post('transcribe')
  @UseInterceptors(FileInterceptor('audio'))
  async transcribe(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: UploadedAudio | undefined,
    @Body() body: { mimeType?: string; durationMs?: string },
  ) {
    this.assertRateLimit(request.user.id);
    const startedAt = Date.now();
    if (!file?.buffer?.length) {
      throw new BadRequestException('Аудиофайл не получен.');
    }
    const durationMs = Number(body.durationMs ?? 0);
    if (!Number.isFinite(durationMs) || durationMs < 500) {
      throw new BadRequestException('Запись слишком короткая.');
    }
    if (durationMs > MAX_DURATION_MS) {
      throw new BadRequestException('Максимальная длительность записи — 5 минут.');
    }
    if (file.size > MAX_AUDIO_BYTES) {
      throw new BadRequestException('Максимальный размер аудиофайла — 20 MB.');
    }

    const mimeType = this.normalizeMime(body.mimeType || file.mimetype || '');
    if (!this.isSupportedMime(mimeType)) {
      throw new BadRequestException('Этот аудиоформат не поддерживается.');
    }

    this.logger.log(
      `Voice transcription started user=${request.user.id} durationMs=${durationMs} mime=${mimeType} size=${file.size}`,
    );
    try {
      const transcript = await this.ai.transcribe(
        file.buffer,
        this.filenameFor(mimeType, file.originalname),
        mimeType,
      );
      this.logger.log(
        `Voice transcription completed user=${request.user.id} elapsedMs=${Date.now() - startedAt}`,
      );
      return { transcript, durationMs };
    } catch (error: unknown) {
      this.logger.warn(
        `Voice transcription failed user=${request.user.id} elapsedMs=${Date.now() - startedAt} error=${this.errorMessage(error)}`,
      );
      throw error;
    }
  }

  @Post('interpret')
  interpret(
    @Req() request: AuthenticatedRequest,
    @Body() body: { transcript?: string },
  ) {
    if (!body.transcript?.trim()) {
      throw new BadRequestException('Текст команды пустой.');
    }
    return this.voiceCommands.interpret(request.user.id, body.transcript, 'VOICE');
  }

  @Post('drafts/:id/confirm')
  confirm(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.voiceCommands.confirm(request.user.id, id);
  }

  @Post('drafts/:id/cancel')
  cancel(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.voiceCommands.cancel(request.user.id, id);
  }

  private assertRateLimit(userId: string) {
    const now = Date.now();
    const current = (this.rateLimit.get(userId) ?? []).filter(
      (timestamp) => now - timestamp < RATE_WINDOW_MS,
    );
    if (current.length >= RATE_LIMIT) {
      throw new BadRequestException('Слишком много голосовых запросов. Попробуйте через минуту.');
    }
    current.push(now);
    this.rateLimit.set(userId, current);
  }

  private normalizeMime(value: string) {
    return value.trim().toLowerCase();
  }

  private isSupportedMime(mimeType: string) {
    if (SUPPORTED_AUDIO_TYPES.has(mimeType)) return true;
    const [base] = mimeType.split(';');
    return SUPPORTED_AUDIO_TYPES.has(base);
  }

  private filenameFor(mimeType: string, originalName?: string) {
    if (originalName?.trim() && originalName.includes('.')) return originalName;
    const base = mimeType.split(';')[0];
    const extension =
      base === 'audio/mp4' || base === 'video/mp4'
        ? 'm4a'
        : base === 'audio/ogg'
          ? 'ogg'
          : base === 'audio/wav' || base === 'audio/x-wav'
            ? 'wav'
            : 'webm';
    return `web-voice.${extension}`;
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpException) return error.message;
    return error instanceof Error ? error.message : 'Unknown voice error';
  }
}
