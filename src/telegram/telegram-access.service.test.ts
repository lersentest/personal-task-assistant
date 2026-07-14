import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { Context } from 'grammy';
import { TelegramAccessService } from './telegram-access.service';

function accessService(allowedId = '123456789'): TelegramAccessService {
  const config = {
    getOrThrow: () => allowedId,
  } as unknown as ConfigService;
  return new TelegramAccessService(config);
}

test('allows only the configured Telegram user', () => {
  const service = accessService();

  assert.equal(service.isAllowed(123456789), true);
  assert.equal(service.isAllowed('123456789'), true);
  assert.equal(service.isAllowed(987654321), false);
  assert.equal(service.isAllowed(undefined), false);
});

test('middleware blocks another Telegram user without calling next', async () => {
  const service = accessService();
  let nextCalled = false;
  const replies: string[] = [];
  const context = {
    from: { id: 987654321 },
    chat: { id: 987654321 },
    reply: async (text: string) => {
      replies.push(text);
      return {};
    },
  } as unknown as Context;

  await service.createMiddleware()(context, async () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.deepEqual(replies, ['Доступ к этому боту ограничен.']);
});
