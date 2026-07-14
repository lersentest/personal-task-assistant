export type TaskStatus = 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type ProjectStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
  _count?: {
    tasks: number;
  };
}

export interface TagLink {
  tag: {
    id: string;
    name: string;
  };
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  dueDateType: 'ON_DATE' | 'BEFORE_DATE' | 'EXACT_TIME' | null;
  remindAt: string | null;
  estimatedDurationMinutes: number | null;
  originalText: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  deletedAt: string | null;
  project: Project | null;
  tags: TagLink[];
}

export interface DashboardData {
  summary: {
    today: number;
    overdue: number;
    upcoming: number;
    urgent: number;
  };
  today: Task[];
  overdue: Task[];
  upcoming: Task[];
  activeProjects: Project[];
}

export interface TaskInput {
  title: string;
  description?: string | null;
  projectId?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueAt?: string | null;
  remindAt?: string | null;
  estimatedDurationMinutes?: number | null;
  tags?: string[];
}

export interface ProjectInput {
  name: string;
  description?: string | null;
  status?: ProjectStatus;
}

export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  taskId: string | null;
  projectId: string | null;
  createdAt: string;
  task?: { id: string; title: string } | null;
  project?: { id: string; name: string } | null;
}

export interface DailyPlanItem {
  id: string;
  userId: string;
  taskId: string;
  date: string;
  order: number;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  scheduleType: 'FLEXIBLE' | 'FIXED';
  addedAt: string;
  removedAt: string | null;
  completedInPlanAt: string | null;
  createdAt: string;
  updatedAt: string;
  task: Task;
}

export interface MyDayData {
  date: string;
  settings: {
    dayStart: string;
    dayEnd: string;
    capacityMinutes: number;
    calendarStepMinutes: number;
    timezone: string;
  };
  summary: {
    totalTasks: number;
    completedTasks: number;
    remainingTasks: number;
    estimatedMinutes: number;
    completedMinutes: number;
    overloaded: boolean;
    conflicts: number;
  };
  mandatory: {
    overdue: Task[];
    dueToday: Task[];
    plannedToday: DailyPlanItem[];
    scheduled: DailyPlanItem[];
  };
  planItems: DailyPlanItem[];
  scheduledItems: DailyPlanItem[];
  completedItems: DailyPlanItem[];
  conflicts: Array<{ firstItemId: string; secondItemId: string }>;
  unresolvedPreviousDays: DailyPlanItem[];
}

export interface VoiceDraft {
  kind: 'PROJECT' | 'TASK' | 'TASK_UPDATE' | 'BULK_TASK_UPDATE';
  draftId: string;
  title: string;
  fields: Array<{ label: string; value: string }>;
  affectedTasks?: string[];
}

export interface VoiceInterpretation {
  transcript: string;
  draft: VoiceDraft;
}

export interface ConfirmedVoiceOperation {
  kind: 'PROJECT' | 'TASK' | 'TASK_UPDATE' | 'BULK_TASK_UPDATE';
  id?: string;
  name?: string;
  title?: string;
  projectName?: string;
  count?: number;
}
