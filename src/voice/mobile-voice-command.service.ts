import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { createHash } from 'crypto';
import { AiCommandService } from '../ai/ai-command.service';
import { PrismaService } from '../database/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';
import { CreateTaskInput } from '../tasks/types/create-task.input';
import { UsersService } from '../users/users.service';
import { MobileDeviceSessionContext } from '../mobile-auth/mobile-auth.service';

type UploadedAudio = {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
  size: number;
};

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const MAX_DURATION_MS = 5 * 60 * 1000;
const DRAFT_TTL_HOURS = 24;
const SUPPORTED_AUDIO_TYPES = new Set([
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/x-m4a',
  'audio/webm',
  'audio/webm;codecs=opus',
  'video/mp4',
  'video/webm',
]);

@Injectable()
export class MobileVoiceCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiCommandService,
    private readonly projects: ProjectsService,
    private readonly tasks: TasksService,
    private readonly users: UsersService,
  ) {}

  async preview(
    mobile: MobileDeviceSessionContext,
    body: {
      idempotencyKey?: string;
      clientCommandId?: string;
      source?: string;
      durationMs?: string;
      transcript?: string;
    },
    file?: UploadedAudio,
  ) {
    const idempotencyKey = this.requiredKey(body.idempotencyKey);
    const clientCommandId = (body.clientCommandId ?? '').trim();
    if (!clientCommandId) throw new BadRequestException('clientCommandId is required.');

    const existing = await this.findCompletedRequest(mobile.id, idempotencyKey);
    if (existing?.response) return existing.response;

    const request = await this.createProcessingRequest(mobile, idempotencyKey, 'PREVIEW');
    try {
      const user = await this.userById(mobile.ownerId);
      const transcript = body.transcript?.trim() || (await this.transcribe(body, file));
      const projects = await this.projects.list(mobile.ownerId);
      const command = await this.ai.parse(transcript, {
        timezone: user.timezone,
        projectNames: projects.map((project) => project.name),
        forcedAction: 'CREATE_TASK',
      });
      if (command.action !== 'CREATE_TASK' || !command.title) {
        throw new BadRequestException('Voice command must describe one new task.');
      }

      const project = command.projectName
        ? await this.projects.findActiveByName(mobile.ownerId, command.projectName)
        : null;
      if (command.projectName && !project) {
        throw new BadRequestException(`Project "${command.projectName}" was not found.`);
      }

      const payload: CreateTaskInput = {
        ownerId: mobile.ownerId,
        createdById: mobile.ownerId,
        assigneeId: mobile.ownerId,
        projectId: project?.id ?? undefined,
        title: command.title,
        description: command.description,
        status: command.status ?? 'NEW',
        priority: command.priority ?? 'NORMAL',
        dueAt: command.dueAt ? new Date(command.dueAt) : null,
        dueDateType: command.dueDateType,
        remindAt: command.remindAt ? new Date(command.remindAt) : null,
        sourceType: 'VOICE',
        originalText: transcript,
        tags: command.tags,
      };
      const preview = this.previewFor(payload, transcript, project?.name ?? command.projectName, user.timezone);
      const draft = await this.prisma.mobileVoiceDraft.upsert({
        where: {
          deviceSessionId_clientCommandId: {
            deviceSessionId: mobile.id,
            clientCommandId,
          },
        },
        update: {
          source: this.source(body.source),
          status: 'READY_FOR_CONFIRMATION',
          transcript,
          taskPayload: this.jsonPayload(payload),
          preview,
          taskId: null,
          expiresAt: DateTime.utc().plus({ hours: DRAFT_TTL_HOURS }).toJSDate(),
          confirmedAt: null,
          cancelledAt: null,
        },
        create: {
          ownerId: mobile.ownerId,
          deviceSessionId: mobile.id,
          clientCommandId,
          source: this.source(body.source),
          transcript,
          taskPayload: this.jsonPayload(payload),
          preview,
          expiresAt: DateTime.utc().plus({ hours: DRAFT_TTL_HOURS }).toJSDate(),
        },
      });
      const response = {
        draftId: draft.id,
        clientCommandId,
        transcript,
        preview,
        expiresAt: draft.expiresAt,
      };
      await this.completeRequest(request.id, draft.id, response);
      return response;
    } catch (error) {
      await this.failRequest(request.id, this.errorCode(error));
      throw error;
    }
  }

  async confirm(
    mobile: MobileDeviceSessionContext,
    body: { draftId?: string; idempotencyKey?: string },
  ) {
    const draftId = (body.draftId ?? '').trim();
    if (!draftId) throw new BadRequestException('draftId is required.');
    const idempotencyKey = this.requiredKey(body.idempotencyKey);

    const existing = await this.findCompletedRequest(mobile.id, idempotencyKey);
    if (existing?.response) return existing.response;

    const request = await this.createProcessingRequest(mobile, idempotencyKey, 'CONFIRM', draftId);
    try {
      const draft = await this.prisma.mobileVoiceDraft.findFirst({
        where: { id: draftId, ownerId: mobile.ownerId, deviceSessionId: mobile.id },
      });
      if (!draft) throw new NotFoundException('Voice draft not found.');
      if (draft.status === 'CONFIRMED' && draft.taskId) {
        const task = await this.tasks.getOwned(mobile.ownerId, draft.taskId);
        const response = { task, draftId: draft.id, alreadyConfirmed: true };
        await this.completeRequest(request.id, draft.id, response);
        return response;
      }
      if (draft.status === 'CANCELLED') throw new ConflictException('Voice draft is cancelled.');
      if (draft.expiresAt.getTime() < Date.now()) {
        await this.prisma.mobileVoiceDraft.update({
          where: { id: draft.id },
          data: { status: 'EXPIRED' },
        });
        throw new ConflictException('Voice draft is expired.');
      }
      const locked = await this.prisma.mobileVoiceDraft.updateMany({
        where: { id: draft.id, status: 'READY_FOR_CONFIRMATION' },
        data: { status: 'CONFIRMING' },
      });
      if (!locked.count) throw new ConflictException('Voice draft is already being processed.');

      const task = await this.tasks.create(this.revivePayload(draft.taskPayload));
      await this.prisma.mobileVoiceDraft.update({
        where: { id: draft.id },
        data: {
          status: 'CONFIRMED',
          taskId: task.id,
          confirmedAt: new Date(),
        },
      });
      const response = { task, draftId: draft.id, alreadyConfirmed: false };
      await this.completeRequest(request.id, draft.id, response);
      return response;
    } catch (error) {
      await this.failRequest(request.id, this.errorCode(error));
      throw error;
    }
  }

  async cancel(
    mobile: MobileDeviceSessionContext,
    body: { draftId?: string; idempotencyKey?: string },
  ) {
    const draftId = (body.draftId ?? '').trim();
    if (!draftId) throw new BadRequestException('draftId is required.');
    const idempotencyKey = this.requiredKey(body.idempotencyKey);
    const existing = await this.findCompletedRequest(mobile.id, idempotencyKey);
    if (existing?.response) return existing.response;

    const request = await this.createProcessingRequest(mobile, idempotencyKey, 'CANCEL', draftId);
    const draft = await this.prisma.mobileVoiceDraft.findFirst({
      where: { id: draftId, ownerId: mobile.ownerId, deviceSessionId: mobile.id },
    });
    if (!draft) throw new NotFoundException('Voice draft not found.');
    await this.prisma.mobileVoiceDraft.update({
      where: { id: draft.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    const response = { ok: true, draftId: draft.id };
    await this.completeRequest(request.id, draft.id, response);
    return response;
  }

  private async transcribe(
    body: { durationMs?: string },
    file?: UploadedAudio,
  ): Promise<string> {
    if (!file?.buffer?.length) throw new BadRequestException('audio file is required.');
    const durationMs = Number(body.durationMs ?? 0);
    if (!Number.isFinite(durationMs) || durationMs < 500) {
      throw new BadRequestException('audio is too short.');
    }
    if (durationMs > MAX_DURATION_MS) {
      throw new BadRequestException('audio duration limit is 5 minutes.');
    }
    if (file.size > MAX_AUDIO_BYTES) {
      throw new BadRequestException('audio file limit is 20 MB.');
    }
    const mimeType = this.normalizeMime(file.mimetype ?? '');
    if (!this.isSupportedMime(mimeType)) {
      throw new BadRequestException('unsupported audio format.');
    }
    return this.ai.transcribe(file.buffer, this.filenameFor(mimeType, file.originalname), mimeType);
  }

  private async createProcessingRequest(
    mobile: MobileDeviceSessionContext,
    idempotencyKey: string,
    requestType: 'PREVIEW' | 'CONFIRM' | 'CANCEL',
    draftId?: string,
  ) {
    const idempotencyKeyHash = this.hashIdempotencyKey(idempotencyKey);
    try {
      return await this.prisma.mobileVoiceRequest.create({
        data: {
          ownerId: mobile.ownerId,
          deviceSessionId: mobile.id,
          draftId,
          idempotencyKeyHash,
          requestType,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const existing = await this.prisma.mobileVoiceRequest.findUnique({
          where: {
            deviceSessionId_idempotencyKeyHash: {
              deviceSessionId: mobile.id,
              idempotencyKeyHash,
            },
          },
        });
        if (existing?.status === 'COMPLETED' && existing.response) return existing;
        throw new ConflictException('Request with this idempotency key is already processing.');
      }
      throw error;
    }
  }

  private findCompletedRequest(deviceSessionId: string, idempotencyKey: string) {
    return this.prisma.mobileVoiceRequest.findUnique({
      where: {
        deviceSessionId_idempotencyKeyHash: {
          deviceSessionId,
          idempotencyKeyHash: this.hashIdempotencyKey(idempotencyKey),
        },
      },
    });
  }

  private completeRequest(id: string, draftId: string | null, response: unknown) {
    return this.prisma.mobileVoiceRequest.update({
      where: { id },
      data: { status: 'COMPLETED', draftId, response: response as object },
    });
  }

  private failRequest(id: string, errorCode: string) {
    return this.prisma.mobileVoiceRequest.update({
      where: { id },
      data: { status: 'FAILED', errorCode },
    });
  }

  private async userById(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  private previewFor(
    payload: CreateTaskInput,
    transcript: string,
    projectName: string | null | undefined,
    timezone: string,
  ) {
    return {
      title: payload.title,
      description: payload.description,
      projectId: payload.projectId ?? null,
      projectName: projectName ?? 'Без проекта',
      status: payload.status ?? 'NEW',
      priority: payload.priority ?? 'NORMAL',
      dueAt: payload.dueAt?.toISOString() ?? null,
      dueDateType: payload.dueDateType ?? null,
      remindAt: payload.remindAt?.toISOString() ?? null,
      estimatedDurationMinutes: payload.estimatedDurationMinutes ?? null,
      tags: payload.tags ?? [],
      transcript,
      display: {
        dueAt: payload.dueAt
          ? DateTime.fromJSDate(payload.dueAt).setZone(timezone).toFormat('dd.LL.yyyy HH:mm')
          : 'Без срока',
      },
    };
  }

  private revivePayload(value: unknown): CreateTaskInput {
    const payload = value as CreateTaskInput & {
      dueAt?: string | Date | null;
      remindAt?: string | Date | null;
    };
    return {
      ...payload,
      dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
      remindAt: payload.remindAt ? new Date(payload.remindAt) : null,
    };
  }

  private jsonPayload(payload: CreateTaskInput) {
    return {
      ...payload,
      dueAt: payload.dueAt?.toISOString() ?? null,
      remindAt: payload.remindAt?.toISOString() ?? null,
    };
  }

  private requiredKey(value: string | undefined) {
    const key = value?.trim();
    if (!key || key.length < 16) {
      throw new BadRequestException('idempotencyKey must contain at least 16 characters.');
    }
    return key;
  }

  private hashIdempotencyKey(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private source(value: string | undefined): 'ANDROID_APP' | 'ANDROID_WIDGET' | 'ANDROID_SIDE_BUTTON' {
    if (value === 'ANDROID_WIDGET' || value === 'ANDROID_SIDE_BUTTON') return value;
    return 'ANDROID_APP';
  }

  private normalizeMime(value: string) {
    return value.trim().toLowerCase();
  }

  private isSupportedMime(mimeType: string) {
    if (SUPPORTED_AUDIO_TYPES.has(mimeType)) return true;
    const [base] = mimeType.split(';');
    return SUPPORTED_AUDIO_TYPES.has(base);
  }

  private filenameFor(mimeType: string, originalName?: string) {
    if (originalName?.trim() && originalName.includes('.')) return originalName;
    const base = mimeType.split(';')[0];
    const extension =
      base === 'audio/mp4' || base === 'video/mp4'
        ? 'm4a'
        : base === 'audio/ogg'
          ? 'ogg'
          : base === 'audio/wav' || base === 'audio/x-wav'
            ? 'wav'
            : 'webm';
    return `android-voice.${extension}`;
  }

  private errorCode(error: unknown) {
    return error instanceof Error ? error.constructor.name : 'UnknownError';
  }
}
