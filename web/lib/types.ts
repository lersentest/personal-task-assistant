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
  tags?: string[];
}

export interface ProjectInput {
  name: string;
  description?: string | null;
  status?: ProjectStatus;
}

