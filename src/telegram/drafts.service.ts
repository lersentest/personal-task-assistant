import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OperationDraft,
  BulkTaskUpdateDraft,
  ProjectDraft,
  TaskDraft,
  TaskUpdateDraft,
} from './types/draft';

const DRAFT_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class DraftsService {
  private readonly drafts = new Map<string, OperationDraft>();

  createProject(
    ownerTelegramId: string,
    payload: ProjectDraft['payload'],
  ): ProjectDraft {
    const draft: ProjectDraft = {
      id: randomUUID(),
      ownerTelegramId,
      kind: 'PROJECT',
      status: 'PENDING',
      payload,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + DRAFT_TTL_MS),
    };
    this.drafts.set(draft.id, draft);
    return draft;
  }

  createTask(
    ownerTelegramId: string,
    payload: TaskDraft['payload'],
  ): TaskDraft {
    const draft: TaskDraft = {
      id: randomUUID(),
      ownerTelegramId,
      kind: 'TASK',
      status: 'PENDING',
      payload,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + DRAFT_TTL_MS),
    };
    this.drafts.set(draft.id, draft);
    return draft;
  }

  createTaskUpdate(
    ownerTelegramId: string,
    payload: TaskUpdateDraft['payload'],
  ): TaskUpdateDraft {
    const draft: TaskUpdateDraft = {
      id: randomUUID(),
      ownerTelegramId,
      kind: 'TASK_UPDATE',
      status: 'PENDING',
      payload,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + DRAFT_TTL_MS),
    };
    this.drafts.set(draft.id, draft);
    return draft;
  }

  createBulkTaskUpdate(
    ownerTelegramId: string,
    payload: BulkTaskUpdateDraft['payload'],
  ): BulkTaskUpdateDraft {
    const draft: BulkTaskUpdateDraft = {
      id: randomUUID(),
      ownerTelegramId,
      kind: 'BULK_TASK_UPDATE',
      status: 'PENDING',
      payload,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + DRAFT_TTL_MS),
    };
    this.drafts.set(draft.id, draft);
    return draft;
  }

  claim(id: string, ownerTelegramId: string): OperationDraft {
    const draft = this.getOwned(id, ownerTelegramId);
    if (draft.status === 'PROCESSING') {
      throw new ConflictException('Этот черновик уже обрабатывается.');
    }
    draft.status = 'PROCESSING';
    return draft;
  }

  release(id: string, ownerTelegramId: string): void {
    const draft = this.drafts.get(id);
    if (draft?.ownerTelegramId === ownerTelegramId) {
      draft.status = 'PENDING';
    }
  }

  complete(id: string, ownerTelegramId: string): void {
    this.getOwned(id, ownerTelegramId);
    this.drafts.delete(id);
  }

  cancel(id: string, ownerTelegramId: string): OperationDraft {
    const draft = this.getOwned(id, ownerTelegramId);
    if (draft.status === 'PROCESSING') {
      throw new ConflictException('Этот черновик уже обрабатывается.');
    }
    this.drafts.delete(id);
    return draft;
  }

  private getOwned(id: string, ownerTelegramId: string): OperationDraft {
    const draft = this.drafts.get(id);
    if (!draft || draft.ownerTelegramId !== ownerTelegramId) {
      throw new NotFoundException('Черновик не найден или уже обработан.');
    }
    if (draft.expiresAt.getTime() <= Date.now()) {
      this.drafts.delete(id);
      throw new NotFoundException('Срок действия черновика истёк.');
    }
    return draft;
  }
}
