import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface AttachmentSummary {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  taskId: string | null;
  projectId: string | null;
  delegatedTaskId: string | null;
  createdAt: Date;
  task?: { id: string; title: string } | null;
  project?: { id: string; name: string } | null;
  delegatedTask?: { id: string; title: string } | null;
}

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly projects: ProjectsService,
  ) {}

  async list(
    ownerId: string,
    filters: { taskId?: string; projectId?: string; delegatedTaskId?: string } = {},
  ): Promise<AttachmentSummary[]> {
    if (filters.taskId) await this.tasks.getOwned(ownerId, filters.taskId, true);
    if (filters.projectId) await this.projects.getOwned(ownerId, filters.projectId);
    if (filters.delegatedTaskId) {
      const delegatedTask = await this.prisma.delegatedTask.findFirst({
        where: { id: filters.delegatedTaskId, ownerId, deletedAt: null },
        select: { id: true },
      });
      if (!delegatedTask) throw new NotFoundException('Delegated task not found.');
    }

    return this.prisma.attachment.findMany({
      where: {
        ownerId,
        deletedAt: null,
        ...(filters.taskId ? { taskId: filters.taskId } : {}),
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.delegatedTaskId ? { delegatedTaskId: filters.delegatedTaskId } : {}),
      },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        taskId: true,
        projectId: true,
        delegatedTaskId: true,
        createdAt: true,
        task: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
        delegatedTask: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async create(
    ownerId: string,
    uploadedById: string,
    input: {
      taskId?: string | null;
      projectId?: string | null;
      delegatedTaskId?: string | null;
      fileName: string;
      mimeType: string;
      dataBase64: string;
    },
  ): Promise<AttachmentSummary> {
    const taskId = input.taskId ?? null;
    const projectId = input.projectId ?? null;
    const delegatedTaskId = input.delegatedTaskId ?? null;
    const targetCount = [taskId, projectId, delegatedTaskId].filter(Boolean).length;
    if (targetCount !== 1) {
      throw new BadRequestException(
        'Attach a file to exactly one task, project, or delegated task.',
      );
    }
    if (taskId) await this.tasks.getOwned(ownerId, taskId, true);
    if (projectId) await this.projects.getOwned(ownerId, projectId);
    if (delegatedTaskId) {
      const delegatedTask = await this.prisma.delegatedTask.findFirst({
        where: { id: delegatedTaskId, ownerId, deletedAt: null },
        select: { id: true },
      });
      if (!delegatedTask) throw new NotFoundException('Delegated task not found.');
    }

    const fileName = input.fileName.trim().slice(0, 255);
    if (!fileName) throw new BadRequestException('File name is required.');

    const mimeType =
      input.mimeType.trim().slice(0, 255) || 'application/octet-stream';
    const data = Buffer.from(input.dataBase64, 'base64');
    if (data.byteLength === 0) {
      throw new BadRequestException('File is empty.');
    }
    if (data.byteLength > MAX_FILE_BYTES) {
      throw new BadRequestException('File is too large. Maximum is 10 MB.');
    }

    const attachment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.attachment.create({
        data: {
          ownerId,
          uploadedById,
          taskId,
          projectId,
          delegatedTaskId,
          fileName,
          mimeType,
          sizeBytes: data.byteLength,
          data,
        },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          taskId: true,
          projectId: true,
          delegatedTaskId: true,
          createdAt: true,
          task: { select: { id: true, title: true } },
          project: { select: { id: true, name: true } },
          delegatedTask: { select: { id: true, title: true } },
        },
      });
      await tx.activityEvent.create({
        data: {
          ownerId,
          actorId: uploadedById,
          type: 'FILE_ADDED',
          taskId,
          projectId,
          fileId: created.id,
          title: created.fileName,
          metadata: { mimeType, sizeBytes: data.byteLength, delegatedTaskId },
        },
      });
      if (delegatedTaskId) {
        await tx.delegatedTaskEvent.create({
          data: {
            taskId: delegatedTaskId,
            ownerId,
            executorId: null,
            type: 'FILE_ADDED',
            title: created.fileName,
            metadata: { mimeType, sizeBytes: data.byteLength, fileId: created.id },
          },
        });
      }
      return created;
    });
    return attachment;
  }

  async createForDelegatedExecutor(
    token: string,
    input: {
      fileName: string;
      mimeType: string;
      dataBase64: string;
    },
  ): Promise<AttachmentSummary> {
    const task = await this.prisma.delegatedTask.findFirst({
      where: {
        publicAccessToken: token,
        publicAccessRevokedAt: null,
        deletedAt: null,
        status: { notIn: ['CANCELLED'] },
      },
      include: { executor: true },
    });
    if (!task) throw new NotFoundException('Delegated task not found.');
    return this.create(task.ownerId, task.ownerId, {
      delegatedTaskId: task.id,
      ...input,
    });
  }

  async getDownload(ownerId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, ownerId, deletedAt: null },
    });
    if (!attachment) throw new NotFoundException('File not found.');
    return attachment;
  }

  async getPublicDelegatedDownload(token: string, attachmentId: string) {
    const task = await this.prisma.delegatedTask.findFirst({
      where: {
        publicAccessToken: token,
        publicAccessRevokedAt: null,
        deletedAt: null,
      },
      select: { id: true, ownerId: true },
    });
    if (!task) throw new NotFoundException('Delegated task not found.');
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        ownerId: task.ownerId,
        delegatedTaskId: task.id,
        deletedAt: null,
      },
    });
    if (!attachment) throw new NotFoundException('File not found.');
    return attachment;
  }

  async softDelete(ownerId: string, attachmentId: string): Promise<void> {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, ownerId, deletedAt: null },
      select: { id: true },
    });
    if (!attachment) throw new NotFoundException('File not found.');
    await this.prisma.attachment.update({
      where: { id: attachmentId },
      data: { deletedAt: new Date() },
    });
  }
}
