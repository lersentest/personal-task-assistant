import { UpdateTaskInput } from '../../tasks/types/update-task.input';

export type DraftKind = 'PROJECT' | 'TASK' | 'TASK_UPDATE' | 'BULK_TASK_UPDATE';
export type DraftStatus = 'PENDING' | 'PROCESSING';

interface BaseDraft {
  id: string;
  ownerTelegramId: string;
  kind: DraftKind;
  status: DraftStatus;
  createdAt: Date;
  expiresAt: Date;
}

export interface ProjectDraft extends BaseDraft {
  kind: 'PROJECT';
  payload: {
    name: string;
    description?: string;
  };
}

export interface TaskDraft extends BaseDraft {
  kind: 'TASK';
  payload: {
    title: string;
    projectName?: string;
    description?: string | null;
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    dueAt?: Date | null;
    dueDateType?: 'ON_DATE' | 'BEFORE_DATE' | 'EXACT_TIME' | null;
    remindAt?: Date | null;
    tags?: string[];
    sourceType?: 'TEXT' | 'VOICE' | 'FORWARDED_MESSAGE';
    originalText: string;
  };
}

export interface TaskUpdateDraft extends BaseDraft {
  kind: 'TASK_UPDATE';
  payload: {
    taskId: string;
    projectName?: string | null;
    changes: Omit<UpdateTaskInput, 'projectId'>;
  };
}

export interface BulkTaskUpdateDraft extends BaseDraft {
  kind: 'BULK_TASK_UPDATE';
  payload: {
    taskIds: string[];
    taskTitles: string[];
    projectName?: string | null;
    changes: Omit<UpdateTaskInput, 'projectId'>;
  };
}

export type OperationDraft =
  | ProjectDraft
  | TaskDraft
  | TaskUpdateDraft
  | BulkTaskUpdateDraft;
