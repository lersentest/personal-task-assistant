export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  projectId?: string | null;
  status?: 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  dueAt?: Date | null;
  dueDateType?: 'ON_DATE' | 'BEFORE_DATE' | 'EXACT_TIME' | null;
  remindAt?: Date | null;
  tags?: string[];
}
