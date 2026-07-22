export type TaskStatus = 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type TaskKind = 'TASK' | 'CALL' | 'MEETING' | 'IDEA' | 'NOTE';
export type ProjectStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
export type ExecutorLanguage = 'RU' | 'UK' | 'EN' | 'DE';
export type ExecutorConnectionStatus = 'NOT_CONNECTED' | 'INVITE_CREATED' | 'CONNECTED' | 'INACTIVE';
export type DelegatedTaskStatus =
  | 'DRAFT'
  | 'SENT'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'QUESTION'
  | 'WAITING_REVIEW'
  | 'RETURNED'
  | 'COMPLETED'
  | 'CANCELLED';

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
  taskStats?: {
    active: number;
    completed: number;
    total: number;
  };
}

export interface TagLink {
  tag: {
    id: string;
    name: string;
  };
}

export interface TaskChecklistItem {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  deletedAt: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  kind: TaskKind;
  isFlexible: boolean;
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
  checklistItems: TaskChecklistItem[];
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
  attention: Task[];
  activeProjects: Project[];
  recentActivity: ActivityEvent[];
}

export interface TaskInput {
  title: string;
  description?: string | null;
  projectId?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  kind?: TaskKind;
  isFlexible?: boolean;
  dueAt?: string | null;
  dueDateType?: 'ON_DATE' | 'BEFORE_DATE' | 'EXACT_TIME' | null;
  remindAt?: string | null;
  estimatedDurationMinutes?: number | null;
  tags?: string[];
  checklistItems?: string[];
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
  delegatedTaskId: string | null;
  createdAt: string;
  task?: { id: string; title: string } | null;
  project?: { id: string; name: string } | null;
  delegatedTask?: { id: string; title: string } | null;
}

export interface ActivityEvent {
  id: string;
  ownerId: string;
  actorId: string;
  type:
    | 'TASK_CREATED'
    | 'TASK_UPDATED'
    | 'TASK_COMPLETED'
    | 'TASK_DELETED'
    | 'PROJECT_CREATED'
    | 'PROJECT_UPDATED'
    | 'FILE_ADDED';
  taskId: string | null;
  projectId: string | null;
  fileId: string | null;
  title: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
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

export interface Executor {
  id: string;
  fullName: string;
  company: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  telegramUserId: string | null;
  telegramUsername: string | null;
  telegramFirstName: string | null;
  telegramLastName: string | null;
  language: ExecutorLanguage;
  timezone: string;
  dailyDigestEnabled: boolean;
  dailyDigestTime: string;
  connectionStatus: ExecutorConnectionStatus;
  isActive: boolean;
  connectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
  invites?: Array<{
    id: string;
    expiresAt: string;
    usedAt: string | null;
    revokedAt: string | null;
    createdAt: string;
  }>;
  _count?: { delegatedTasks: number };
}

export interface ExecutorInput {
  fullName: string;
  company?: string | null;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  language?: ExecutorLanguage;
  timezone?: string | null;
  dailyDigestEnabled?: boolean;
  dailyDigestTime?: string | null;
  isActive?: boolean;
}

export interface DelegatedTaskComment {
  id: string;
  taskId: string;
  ownerId: string;
  executorId: string | null;
  author: 'OWNER' | 'EXECUTOR' | 'SYSTEM';
  message: string;
  createdAt: string;
  deletedAt: string | null;
}

export interface DelegatedTask {
  id: string;
  ownerId: string;
  executorId: string;
  projectId: string | null;
  title: string;
  description: string | null;
  resultText: string | null;
  status: DelegatedTaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  returnedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  lastReminderAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  executor: Executor;
  project: Project | null;
  comments: DelegatedTaskComment[];
  attachments?: Attachment[];
  events?: Array<{ id: string; type: string; title: string; createdAt: string; metadata: Record<string, unknown> | null }>;
}

export interface DelegatedTaskInput {
  executorId: string;
  projectId?: string | null;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  dueAt?: string | null;
}

export interface AiChatArtifact {
  type: 'table' | 'chart';
  title: string;
  columns?: string[];
  rows?: Record<string, unknown>[];
  rowCount?: number;
  truncated?: boolean;
  chartType?: 'bar' | 'line';
  xKey?: string;
  yKey?: string;
  data?: Array<Record<string, string | number | null>>;
}

export interface AiChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  model: string | null;
  artifacts: AiChatArtifact[] | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AiChatConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: AiChatMessage[];
}
