import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TelegramUserProfile } from './types/telegram-user-profile';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  ensureTelegramUser(profile: TelegramUserProfile) {
    const telegramId = BigInt(profile.telegramId);

    return this.prisma.user.upsert({
      where: { telegramId },
      update: {
        username: profile.username ?? null,
        firstName: profile.firstName,
        lastName: profile.lastName ?? null,
        languageCode: profile.languageCode ?? null,
      },
      create: {
        telegramId,
        username: profile.username ?? null,
        firstName: profile.firstName,
        lastName: profile.lastName ?? null,
        languageCode: profile.languageCode ?? null,
      },
    });
  }

  findByTelegramId(telegramId: string) {
    return this.prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });
  }

  findByAuthUserId(authUserId: string) {
    return this.prisma.user.findUnique({
      where: { authUserId },
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async linkAuthUserToTelegramOwner(authUserId: string, telegramId: string) {
    const existing = await this.findByAuthUserId(authUserId);
    if (existing) return existing;

    const user = await this.findByTelegramId(telegramId);
    if (!user) return null;

    return this.prisma.user.update({
      where: { id: user.id },
      data: { authUserId },
    });
  }

  listAll() {
    return this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  }
}
