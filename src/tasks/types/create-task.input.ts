export interface CreateTaskInput {
  ownerId: string;
  createdById: string;
  assigneeId: string;
  projectId?: string | null;
  title: string;
  description?: string | null;
  originalText?: string | null;
  status?: 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  dueAt?: Date | null;
  dueDateType?: 'ON_DATE' | 'BEFORE_DATE' | 'EXACT_TIME' | null;
  remindAt?: Date | null;
  estimatedDurationMinutes?: number | null;
  sourceType?: 'TEXT' | 'VOICE' | 'FORWARDED_MESSAGE';
  tags?: string[];
}
