import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export const taskStatusSchema = z.enum([
  'NEW',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);
export const taskPrioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
export const taskKindSchema = z.enum(['TASK', 'CALL', 'MEETING', 'IDEA', 'NOTE']);
export const dueDateTypeSchema = z.enum([
  'ON_DATE',
  'BEFORE_DATE',
  'EXACT_TIME',
]);
export const projectStatusSchema = z.enum([
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'ARCHIVED',
]);
export const executorLanguageSchema = z.enum(['RU', 'UK', 'EN', 'DE']);
export const delegatedTaskStatusSchema = z.enum([
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'IN_PROGRESS',
  'QUESTION',
  'WAITING_REVIEW',
  'RETURNED',
  'COMPLETED',
  'CANCELLED',
]);

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  kind: taskKindSchema.optional(),
  isFlexible: z.boolean().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  dueDateType: dueDateTypeSchema.nullable().optional(),
  remindAt: z.string().datetime().nullable().optional(),
  estimatedDurationMinutes: z.number().int().min(5).max(1440).nullable().optional(),
  tags: z.array(z.string().min(1).max(80)).max(10).optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const listTasksSchema = z.object({
  view: z
    .enum(['TODAY', 'OVERDUE', 'UPCOMING', 'ALL', 'COMPLETED', 'CANCELLED', 'TRASH'])
    .default('ALL'),
  projectId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  kind: taskKindSchema.optional(),
  unassigned: z.coerce.boolean().optional(),
  sort: z.enum(['dueAt', 'priority', 'createdAt', 'updatedAt']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  status: projectStatusSchema.optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const createExecutorSchema = z.object({
  fullName: z.string().min(1).max(255),
  company: z.string().max(255).nullable().optional(),
  role: z.string().max(255).nullable().optional(),
  email: z.string().max(255).nullable().optional(),
  phone: z.string().max(64).nullable().optional(),
  language: executorLanguageSchema.optional(),
  timezone: z.string().max(64).nullable().optional(),
  dailyDigestEnabled: z.boolean().optional(),
  dailyDigestTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateExecutorSchema = createExecutorSchema.partial();

export const listDelegatedTasksSchema = z.object({
  executorId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  status: delegatedTaskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  search: z.string().max(200).optional(),
});

export const createDelegatedTaskSchema = z.object({
  executorId: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).nullable().optional(),
  priority: taskPrioritySchema.optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

export const updateDelegatedTaskSchema = createDelegatedTaskSchema.partial().extend({
  status: delegatedTaskStatusSchema.optional(),
  resultText: z.string().max(10000).nullable().optional(),
});

export const delegatedCommentSchema = z.object({
  message: z.string().min(1).max(10000),
});

export const publicDelegatedActionSchema = z.object({
  action: z.enum(['accept', 'start', 'question', 'done']),
  message: z.string().max(10000).nullable().optional(),
});

export const reviewDelegatedTaskSchema = z.object({
  message: z.string().max(10000).nullable().optional(),
});

export const listAttachmentsSchema = z.object({
  taskId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  delegatedTaskId: z.string().uuid().optional(),
});

export const createAttachmentSchema = z.object({
  taskId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  delegatedTaskId: z.string().uuid().nullable().optional(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  dataBase64: z.string().min(1),
});

export const myDayDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const myDaySuggestionsSchema = myDayDateSchema.extend({
  search: z.string().max(200).optional(),
  projectId: z.string().uuid().optional(),
  priority: taskPrioritySchema.optional(),
  tagId: z.string().uuid().optional(),
  unassigned: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

export const createDailyPlanItemSchema = z.object({
  taskId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledStartAt: z.string().datetime().nullable().optional(),
  scheduledEndAt: z.string().datetime().nullable().optional(),
  estimatedDurationMinutes: z.number().int().min(5).max(1440).nullable().optional(),
});

export const updateDailyPlanItemSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  order: z.number().int().min(0).optional(),
  scheduledStartAt: z.string().datetime().nullable().optional(),
  scheduledEndAt: z.string().datetime().nullable().optional(),
  estimatedDurationMinutes: z.number().int().min(5).max(1440).nullable().optional(),
});

export const scheduleDailyPlanItemSchema = z.object({
  scheduledStartAt: z.string().datetime(),
  scheduledEndAt: z.string().datetime(),
  estimatedDurationMinutes: z.number().int().min(5).max(1440).nullable().optional(),
});

export const reorderDailyPlanItemsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  itemIds: z.array(z.string().uuid()).min(1).max(200),
});

export const completeMyDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  actions: z.array(z.object({
    itemId: z.string().uuid(),
    action: z.enum(['TOMORROW', 'BACKLOG', 'KEEP', 'CANCEL']),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })).max(200).default([]),
});

export function parseDto<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException({
      message: 'Invalid request data',
      issues: result.error.issues,
    });
  }
  return result.data;
}

export function optionalDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}
