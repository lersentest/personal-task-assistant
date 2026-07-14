import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Context, MiddlewareFn } from 'grammy';

@Injectable()
export class TelegramAccessService {
  private readonly allowedTelegramId: string;

  constructor(configService: ConfigService) {
    this.allowedTelegramId = configService.getOrThrow<string>(
      'ALLOWED_TELEGRAM_USER_ID',
    );
  }

  isAllowed(telegramId: number | string | undefined): boolean {
    return telegramId !== undefined && String(telegramId) === this.allowedTelegramId;
  }

  createMiddleware(): MiddlewareFn<Context> {
    return async (ctx, next) => {
      if (!this.isAllowed(ctx.from?.id)) {
        if (ctx.chat) {
          await ctx.reply('Доступ к этому боту ограничен.');
        }
        return;
      }
      await next();
    };
  }
}
