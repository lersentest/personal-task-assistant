import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export const taskStatusSchema = z.enum([
  'NEW',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);
export const taskPrioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
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

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  dueAt: z.string().datetime().nullable().optional(),
  dueDateType: dueDateTypeSchema.nullable().optional(),
  remindAt: z.string().datetime().nullable().optional(),
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

