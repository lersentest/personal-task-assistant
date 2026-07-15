export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  projectId?: string | null;
  status?: 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  kind?: 'TASK' | 'CALL' | 'MEETING' | 'IDEA' | 'NOTE';
  isFlexible?: boolean;
  dueAt?: Date | null;
  dueDateType?: 'ON_DATE' | 'BEFORE_DATE' | 'EXACT_TIME' | null;
  remindAt?: Date | null;
  estimatedDurationMinutes?: number | null;
  tags?: string[];
}
