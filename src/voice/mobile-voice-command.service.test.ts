import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { MobileVoiceCommandService } from './mobile-voice-command.service';
import { TasksService } from '../tasks/tasks.service';

test('mobile confirm is idempotent and creates a task only once', async () => {
  let taskCreateCalls = 0;
  const draft = {
    id: 'draft-1',
    ownerId: 'user-1',
    deviceSessionId: 'device-1',
    status: 'READY_FOR_CONFIRMATION',
    taskId: null as string | null,
    expiresAt: new Date(Date.now() + 60_000),
    taskPayload: {
      ownerId: 'user-1',
      createdById: 'user-1',
      assigneeId: 'user-1',
      title: 'Call accountant',
      sourceType: 'VOICE',
      dueAt: null,
      remindAt: null,
    },
  };
  const requests: any[] = [];
  const prisma = {
    mobileVoiceRequest: {
      findUnique: async ({ where }: any) =>
        requests.find(
          (request) =>
            request.deviceSessionId ===
              where.deviceSessionId_idempotencyKeyHash.deviceSessionId &&
            request.idempotencyKeyHash ===
              where.deviceSessionId_idempotencyKeyHash.idempotencyKeyHash,
        ) ?? null,
      create: async ({ data }: any) => {
        const item = { id: `request-${requests.length + 1}`, status: 'PROCESSING', ...data };
        requests.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const item = requests.find((request) => request.id === where.id);
        Object.assign(item, data);
        return item;
      },
    },
    mobileVoiceDraft: {
      findFirst: async () => draft,
      updateMany: async ({ data }: any) => {
        if (draft.status !== 'READY_FOR_CONFIRMATION') return { count: 0 };
        Object.assign(draft, data);
        return { count: 1 };
      },
      update: async ({ data }: any) => {
        Object.assign(draft, data);
        return draft;
      },
    },
  };
  const tasks = {
    create: async (input: any) => {
      taskCreateCalls += 1;
      assert.equal(input.title, 'Call accountant');
      return { id: 'task-1', title: input.title };
    },
    getOwned: async () => ({ id: 'task-1', title: 'Call accountant' }),
  } as unknown as TasksService;

  const service = new MobileVoiceCommandService(
    prisma as any,
    undefined as any,
    undefined as any,
    tasks,
    undefined as any,
  );
  const mobile = {
    id: 'device-1',
    ownerId: 'user-1',
    platform: 'ANDROID' as const,
    deviceName: 'Samsung',
  };

  const first = await service.confirm(mobile, {
    draftId: 'draft-1',
    idempotencyKey: 'confirm-key-123456',
  });
  const second = await service.confirm(mobile, {
    draftId: 'draft-1',
    idempotencyKey: 'confirm-key-123456',
  });

  assert.equal(taskCreateCalls, 1);
  assert.equal((first as any).task.id, 'task-1');
  assert.deepEqual(second, first);
});
