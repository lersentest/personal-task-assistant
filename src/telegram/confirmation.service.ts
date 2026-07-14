import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';
import { TelegramUserProfile } from '../users/types/telegram-user-profile';
import { UsersService } from '../users/users.service';
import { DraftsService } from './drafts.service';

export type ConfirmedOperation =
  | { kind: 'PROJECT'; id: string; name: string }
  | { kind: 'TASK'; id: string; title: string; projectName?: string }
  | { kind: 'TASK_UPDATE'; id: string; title: string }
  | { kind: 'BULK_TASK_UPDATE'; count: number };

@Injectable()
export class ConfirmationService {
  constructor(
    private readonly drafts: DraftsService,
    private readonly users: UsersService,
    private readonly projects: ProjectsService,
    private readonly tasks: TasksService,
  ) {}

  async confirm(
    draftId: string,
    ownerTelegramId: string,
    profile: TelegramUserProfile,
  ): Promise<ConfirmedOperation> {
    const draft = this.drafts.claim(draftId, ownerTelegramId);

    try {
      const user = await this.users.ensureTelegramUser(profile);

      if (draft.kind === 'PROJECT') {
        const project = await this.projects.create({
          ownerId: user.id,
          createdById: user.id,
          name: draft.payload.name,
          description: draft.payload.description,
        });
        this.drafts.complete(draft.id, ownerTelegramId);
        return { kind: 'PROJECT', id: project.id, name: project.name };
      }

      if (draft.kind === 'TASK_UPDATE') {
        let projectId: string | null | undefined;
        if (draft.payload.projectName !== undefined) {
          if (draft.payload.projectName === null) {
            projectId = null;
          } else {
            const project = await this.projects.findActiveByName(
              user.id,
              draft.payload.projectName,
            );
            if (!project) {
              throw new NotFoundException(
                `Проект «${draft.payload.projectName}» не найден.`,
              );
            }
            projectId = project.id;
          }
        }
        const task = await this.tasks.update(user.id, draft.payload.taskId, {
          ...draft.payload.changes,
          ...(projectId !== undefined ? { projectId } : {}),
        });
        this.drafts.complete(draft.id, ownerTelegramId);
        return { kind: 'TASK_UPDATE', id: task.id, title: task.title };
      }

      if (draft.kind === 'BULK_TASK_UPDATE') {
        let projectId: string | null | undefined;
        if (draft.payload.projectName !== undefined) {
          if (draft.payload.projectName === null) {
            projectId = null;
          } else {
            const project = await this.projects.findActiveByName(
              user.id,
              draft.payload.projectName,
            );
            if (!project) {
              throw new NotFoundException(
                `РџСЂРѕРµРєС‚ В«${draft.payload.projectName}В» РЅРµ РЅР°Р№РґРµРЅ.`,
              );
            }
            projectId = project.id;
          }
        }
        const tasks = await this.tasks.bulkUpdate(user.id, draft.payload.taskIds, {
          ...draft.payload.changes,
          ...(projectId !== undefined ? { projectId } : {}),
        });
        this.drafts.complete(draft.id, ownerTelegramId);
        return { kind: 'BULK_TASK_UPDATE', count: tasks.length };
      }

      const project = draft.payload.projectName
        ? await this.projects.findActiveByName(
            user.id,
            draft.payload.projectName,
          )
        : null;

      if (draft.payload.projectName && !project) {
        throw new NotFoundException(
          `Проект «${draft.payload.projectName}» не найден.`,
        );
      }

      const task = await this.tasks.create({
        ownerId: user.id,
        createdById: user.id,
        assigneeId: user.id,
        projectId: project?.id ?? null,
        title: draft.payload.title,
        ...(draft.payload.description !== undefined
          ? { description: draft.payload.description }
          : {}),
        ...(draft.payload.priority !== undefined
          ? { priority: draft.payload.priority }
          : {}),
        ...(draft.payload.dueAt !== undefined
          ? { dueAt: draft.payload.dueAt }
          : {}),
        ...(draft.payload.dueDateType !== undefined
          ? { dueDateType: draft.payload.dueDateType }
          : {}),
        ...(draft.payload.remindAt !== undefined
          ? { remindAt: draft.payload.remindAt }
          : {}),
        ...(draft.payload.tags !== undefined
          ? { tags: draft.payload.tags }
          : {}),
        ...(draft.payload.sourceType !== undefined
          ? { sourceType: draft.payload.sourceType }
          : {}),
        originalText: draft.payload.originalText,
      });
      this.drafts.complete(draft.id, ownerTelegramId);
      return {
        kind: 'TASK',
        id: task.id,
        title: task.title,
        ...(project ? { projectName: project.name } : {}),
      };
    } catch (error: unknown) {
      this.drafts.release(draft.id, ownerTelegramId);
      throw error;
    }
  }

  cancel(draftId: string, ownerTelegramId: string): void {
    this.drafts.cancel(draftId, ownerTelegramId);
  }
}
