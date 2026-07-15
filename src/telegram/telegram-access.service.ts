import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Context, MiddlewareFn } from 'grammy';
import { ExecutorsService } from '../executors/executors.service';

@Injectable()
export class TelegramAccessService {
  private readonly allowedTelegramId: string;

  constructor(
    configService: ConfigService,
    private readonly executors: ExecutorsService,
  ) {
    this.allowedTelegramId = configService.getOrThrow<string>(
      'ALLOWED_TELEGRAM_USER_ID',
    );
  }

  isAllowed(telegramId: number | string | undefined): boolean {
    return telegramId !== undefined && String(telegramId) === this.allowedTelegramId;
  }

  async isConnectedExecutor(telegramId: number | string | undefined): Promise<boolean> {
    if (telegramId === undefined) return false;
    const executor = await this.executors.findConnectedByTelegramId(String(telegramId));
    return Boolean(executor);
  }

  createMiddleware(): MiddlewareFn<Context> {
    return async (ctx, next) => {
      if (this.isAllowed(ctx.from?.id)) {
        await next();
        return;
      }

      const text = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;
      const startPayload = text?.startsWith('/start ')
        ? text.slice('/start '.length).trim()
        : undefined;
      if (this.executors.isInviteToken(startPayload)) {
        await next();
        return;
      }

      if (await this.isConnectedExecutor(ctx.from?.id)) {
        await next();
        return;
      }

      if (ctx.chat) {
        await ctx.reply('Доступ к этому боту ограничен.');
      }
    };
  }
}
