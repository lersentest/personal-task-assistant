export type TaskView =
  | 'TODAY'
  | 'OVERDUE'
  | 'UPCOMING'
  | 'ALL'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'TRASH';

export interface ListTasksOptions {
  view: TaskView;
  timezone: string;
  projectId?: string;
  tagId?: string;
  search?: string;
  limit?: number;
  status?: 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  unassigned?: boolean;
  sort?: 'dueAt' | 'priority' | 'createdAt' | 'updatedAt';
}

export interface BulkTaskFilter {
  projectId?: string | null;
  projectName?: string | null;
  search?: string | null;
  tag?: string | null;
  status?: 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | null;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | null;
  view?: TaskView | null;
  unassigned?: boolean | null;
}
