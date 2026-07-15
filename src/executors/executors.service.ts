import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

const executorInclude = {
  invites: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
  _count: {
    select: {
      delegatedTasks: {
        where: { deletedAt: null },
      },
    },
  },
} as const;

export type ExecutorDetails = Prisma.ExecutorGetPayload<{
  include: typeof executorInclude;
}>;

export interface CreateExecutorInput {
  fullName: string;
  company?: string | null;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  language?: 'RU' | 'UK' | 'EN' | 'DE';
  timezone?: string | null;
  dailyDigestEnabled?: boolean;
  dailyDigestTime?: string | null;
  isActive?: boolean;
}

export type UpdateExecutorInput = Partial<CreateExecutorInput>;

type NormalizedExecutorInput = {
  fullName?: string;
  company?: string | null;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  language?: 'RU' | 'UK' | 'EN' | 'DE';
  timezone?: string;
  dailyDigestEnabled?: boolean;
  dailyDigestTime?: string;
  isActive?: boolean;
};

@Injectable()
export class ExecutorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  list(ownerId: string): Promise<ExecutorDetails[]> {
    return this.prisma.executor.findMany({
      where: { ownerId, deletedAt: null },
      include: executorInclude,
      orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
    });
  }

  async getOwned(ownerId: string, executorId: string): Promise<ExecutorDetails> {
    const executor = await this.prisma.executor.findFirst({
      where: { id: executorId, ownerId, deletedAt: null },
      include: executorInclude,
    });
    if (!executor) throw new NotFoundException('Executor not found.');
    return executor;
  }

  async create(
    ownerId: string,
    input: CreateExecutorInput,
  ): Promise<ExecutorDetails> {
    const data = this.normalizeInput(input, true);
    const executor = await this.prisma.executor.create({
      data: {
        ownerId,
        fullName: data.fullName!,
        company: data.company,
        role: data.role,
        email: data.email,
        phone: data.phone,
        language: data.language ?? 'RU',
        timezone: data.timezone ?? this.defaultTimezone(),
        dailyDigestEnabled: data.dailyDigestEnabled ?? true,
        dailyDigestTime: data.dailyDigestTime ?? '08:00',
        isActive: data.isActive,
      },
    });
    return this.getOwned(ownerId, executor.id);
  }

  async update(
    ownerId: string,
    executorId: string,
    input: UpdateExecutorInput,
  ): Promise<ExecutorDetails> {
    await this.getOwned(ownerId, executorId);
    const data = this.normalizeInput(input, false);
    await this.prisma.executor.update({
      where: { id: executorId },
      data,
    });
    return this.getOwned(ownerId, executorId);
  }

  async softDelete(ownerId: string, executorId: string): Promise<void> {
    await this.getOwned(ownerId, executorId);
    await this.prisma.executor.update({
      where: { id: executorId },
      data: {
        isActive: false,
        connectionStatus: 'INACTIVE',
        deletedAt: new Date(),
      },
    });
  }

  async createInvite(ownerId: string, executorId: string) {
    const executor = await this.getOwned(ownerId, executorId);
    const token = `exec_${randomBytes(24).toString('base64url')}`;
    const ttlDays = this.numberConfig('EXECUTOR_INVITE_TTL_DAYS', 7);
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.executorInvite.updateMany({
        where: { executorId, usedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.executorInvite.create({
        data: {
          executorId,
          tokenHash: this.hashToken(token),
          expiresAt,
        },
      });
      await tx.executor.update({
        where: { id: executorId },
        data: {
          connectionStatus:
            executor.connectionStatus === 'CONNECTED'
              ? 'CONNECTED'
              : 'INVITE_CREATED',
        },
      });
    });

    return {
      token,
      expiresAt,
      link: this.inviteLink(token),
    };
  }

  async revokeInvite(ownerId: string, executorId: string): Promise<void> {
    await this.getOwned(ownerId, executorId);
    await this.prisma.executorInvite.updateMany({
      where: { executorId, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.prisma.executor.update({
      where: { id: executorId },
      data: { connectionStatus: 'NOT_CONNECTED' },
    });
  }

  async connectByInvite(
    token: string,
    profile: {
      telegramId: string;
      username?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    },
  ) {
    const tokenHash = this.hashToken(token);
    const invite = await this.prisma.executorInvite.findUnique({
      where: { tokenHash },
      include: { executor: true },
    });
    if (!invite || invite.usedAt || invite.revokedAt || invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite is invalid or expired.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.executorInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });
      return tx.executor.update({
        where: { id: invite.executorId },
        data: {
          telegramUserId: BigInt(profile.telegramId),
          telegramUsername: profile.username ?? null,
          telegramFirstName: profile.firstName ?? null,
          telegramLastName: profile.lastName ?? null,
          connectedAt: new Date(),
          connectionStatus: 'CONNECTED',
          isActive: true,
        },
      });
    });
  }

  findConnectedByTelegramId(telegramId: string) {
    return this.prisma.executor.findFirst({
      where: {
        telegramUserId: BigInt(telegramId),
        connectionStatus: 'CONNECTED',
        isActive: true,
        deletedAt: null,
      },
    });
  }

  isInviteToken(value: string | undefined): boolean {
    return Boolean(value?.startsWith('exec_'));
  }

  private normalizeInput(
    input: UpdateExecutorInput,
    requireName: boolean,
  ): NormalizedExecutorInput {
    const fullName =
      input.fullName !== undefined ? input.fullName.trim() : undefined;
    if (requireName && !fullName) {
      throw new BadRequestException('Executor name is required.');
    }
    if (fullName !== undefined && !fullName) {
      throw new BadRequestException('Executor name is required.');
    }
    const dailyDigestTime =
      input.dailyDigestTime === undefined
        ? undefined
        : input.dailyDigestTime?.trim() || '08:00';
    if (dailyDigestTime && !/^\d{2}:\d{2}$/.test(dailyDigestTime)) {
      throw new BadRequestException('Digest time must be HH:mm.');
    }
    return {
      ...(fullName !== undefined ? { fullName } : {}),
      ...(input.company !== undefined
        ? { company: input.company?.trim() || null }
        : {}),
      ...(input.role !== undefined ? { role: input.role?.trim() || null } : {}),
      ...(input.email !== undefined
        ? { email: input.email?.trim() || null }
        : {}),
      ...(input.phone !== undefined
        ? { phone: input.phone?.trim() || null }
        : {}),
      ...(input.language !== undefined ? { language: input.language } : {}),
      ...(input.timezone !== undefined
        ? { timezone: input.timezone?.trim() || this.defaultTimezone() }
        : {}),
      ...(input.dailyDigestEnabled !== undefined
        ? { dailyDigestEnabled: input.dailyDigestEnabled }
        : {}),
      ...(dailyDigestTime !== undefined ? { dailyDigestTime } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  compareToken(a: string, b: string): boolean {
    const first = Buffer.from(this.hashToken(a));
    const second = Buffer.from(this.hashToken(b));
    return first.length === second.length && timingSafeEqual(first, second);
  }

  private inviteLink(token: string): string {
    const username =
      this.config.get<string>('TELEGRAM_BOT_USERNAME') ||
      this.config.get<string>('BOT_USERNAME') ||
      'david_personal_task_bot';
    return `https://t.me/${username.replace(/^@/, '')}?start=${token}`;
  }

  private defaultTimezone(): string {
    return (
      this.config.get<string>('DEFAULT_EXECUTOR_TIMEZONE') || 'Europe/Zurich'
    );
  }

  private numberConfig(key: string, fallback: number): number {
    const raw = this.config.get<string>(key);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
