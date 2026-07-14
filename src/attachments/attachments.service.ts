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
  createdAt: Date;
  task?: { id: string; title: string } | null;
  project?: { id: string; name: string } | null;
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
    filters: { taskId?: string; projectId?: string } = {},
  ): Promise<AttachmentSummary[]> {
    if (filters.taskId) await this.tasks.getOwned(ownerId, filters.taskId, true);
    if (filters.projectId) await this.projects.getOwned(ownerId, filters.projectId);

    return this.prisma.attachment.findMany({
      where: {
        ownerId,
        deletedAt: null,
        ...(filters.taskId ? { taskId: filters.taskId } : {}),
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
      },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        taskId: true,
        projectId: true,
        createdAt: true,
        task: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
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
      fileName: string;
      mimeType: string;
      dataBase64: string;
    },
  ): Promise<AttachmentSummary> {
    const taskId = input.taskId ?? null;
    const projectId = input.projectId ?? null;
    if ((taskId && projectId) || (!taskId && !projectId)) {
      throw new BadRequestException(
        'Attach a file to exactly one task or project.',
      );
    }
    if (taskId) await this.tasks.getOwned(ownerId, taskId, true);
    if (projectId) await this.projects.getOwned(ownerId, projectId);

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

    const attachment = await this.prisma.attachment.create({
      data: {
        ownerId,
        uploadedById,
        taskId,
        projectId,
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
        createdAt: true,
        task: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
      },
    });
    return attachment;
  }

  async getDownload(ownerId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, ownerId, deletedAt: null },
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
