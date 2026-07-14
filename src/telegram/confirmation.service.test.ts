import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';
import { UsersService } from '../users/users.service';
import { ConfirmationService } from './confirmation.service';
import { DraftsService } from './drafts.service';

const profile = {
  telegramId: '123456789',
  firstName: 'David',
};

test('does not create a project before confirmation and creates it once after', async () => {
  const drafts = new DraftsService();
  let projectCreateCalls = 0;
  const users = {
    ensureTelegramUser: async () => ({ id: 'user-1' }),
  } as unknown as UsersService;
  const projects = {
    create: async (input: { name: string }) => {
      projectCreateCalls += 1;
      return { id: 'project-1', name: input.name };
    },
    findActiveByName: async () => null,
  } as unknown as ProjectsService;
  const tasks = { create: async () => undefined } as unknown as TasksService;
  const confirmation = new ConfirmationService(
    drafts,
    users,
    projects,
    tasks,
  );
  const draft = drafts.createProject(profile.telegramId, {
    name: 'Villa Geneva',
  });

  assert.equal(projectCreateCalls, 0);
  const result = await confirmation.confirm(
    draft.id,
    profile.telegramId,
    profile,
  );

  assert.equal(projectCreateCalls, 1);
  assert.deepEqual(result, {
    kind: 'PROJECT',
    id: 'project-1',
    name: 'Villa Geneva',
  });
  await assert.rejects(
    confirmation.confirm(draft.id, profile.telegramId, profile),
    /Черновик не найден/,
  );
});

test('confirmation creates a task with owner, creator and assignee set to the user', async () => {
  const drafts = new DraftsService();
  let taskInput: Record<string, unknown> | undefined;
  const users = {
    ensureTelegramUser: async () => ({ id: 'user-1' }),
  } as unknown as UsersService;
  const projects = {
    findActiveByName: async () => ({ id: 'project-1', name: 'Dublin' }),
  } as unknown as ProjectsService;
  const tasks = {
    create: async (input: Record<string, unknown>) => {
      taskInput = input;
      return { id: 'task-1', title: input.title as string };
    },
  } as unknown as TasksService;
  const confirmation = new ConfirmationService(
    drafts,
    users,
    projects,
    tasks,
  );
  const draft = drafts.createTask(profile.telegramId, {
    title: 'Проверить оплату',
    projectName: 'Dublin',
    originalText: 'Проверить оплату | Dublin',
  });

  await confirmation.confirm(draft.id, profile.telegramId, profile);

  assert.deepEqual(taskInput, {
    ownerId: 'user-1',
    createdById: 'user-1',
    assigneeId: 'user-1',
    projectId: 'project-1',
    title: 'Проверить оплату',
    originalText: 'Проверить оплату | Dublin',
  });
});

test('cancelled draft cannot be confirmed and causes no write', async () => {
  const drafts = new DraftsService();
  let taskCreateCalls = 0;
  const users = {
    ensureTelegramUser: async () => ({ id: 'user-1' }),
  } as unknown as UsersService;
  const projects = {
    findActiveByName: async () => null,
  } as unknown as ProjectsService;
  const tasks = {
    create: async () => {
      taskCreateCalls += 1;
      return { id: 'task-1', title: 'Позвонить бухгалтеру' };
    },
  } as unknown as TasksService;
  const confirmation = new ConfirmationService(
    drafts,
    users,
    projects,
    tasks,
  );
  const draft = drafts.createTask(profile.telegramId, {
    title: 'Позвонить бухгалтеру',
    originalText: 'Позвонить бухгалтеру',
  });

  confirmation.cancel(draft.id, profile.telegramId);

  await assert.rejects(
    confirmation.confirm(draft.id, profile.telegramId, profile),
    /Черновик не найден/,
  );
  assert.equal(taskCreateCalls, 0);
});

test('task update changes data only after confirmation', async () => {
  const drafts = new DraftsService();
  let updateInput: Record<string, unknown> | undefined;
  const users = {
    ensureTelegramUser: async () => ({ id: 'user-1' }),
  } as unknown as UsersService;
  const projects = {
    findActiveByName: async () => ({ id: 'project-2', name: 'Lisbon' }),
  } as unknown as ProjectsService;
  const tasks = {
    update: async (
      _ownerId: string,
      _taskId: string,
      input: Record<string, unknown>,
    ) => {
      updateInput = input;
      return { id: 'task-1', title: 'Проверить оплату' };
    },
  } as unknown as TasksService;
  const confirmation = new ConfirmationService(
    drafts,
    users,
    projects,
    tasks,
  );
  const draft = drafts.createTaskUpdate(profile.telegramId, {
    taskId: 'task-1',
    projectName: 'Lisbon',
    changes: { priority: 'URGENT', status: 'IN_PROGRESS' },
  });

  assert.equal(updateInput, undefined);
  const result = await confirmation.confirm(
    draft.id,
    profile.telegramId,
    profile,
  );

  assert.deepEqual(updateInput, {
    projectId: 'project-2',
    priority: 'URGENT',
    status: 'IN_PROGRESS',
  });
  assert.deepEqual(result, {
    kind: 'TASK_UPDATE',
    id: 'task-1',
    title: 'Проверить оплату',
  });
});
