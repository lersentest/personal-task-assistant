import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '../database/prisma.service';

export type MobileDeviceSessionContext = {
  id: string;
  ownerId: string;
  platform: 'ANDROID' | 'WEAR_OS';
  deviceName: string;
};

@Injectable()
export class MobileAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async createDeviceSession(input: {
    ownerId: string;
    deviceName: string;
    platform?: 'ANDROID' | 'WEAR_OS';
  }) {
    const id = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    const token = `mvt_${id}_${secret}`;
    const session = await this.prisma.mobileDeviceSession.create({
      data: {
        id,
        ownerId: input.ownerId,
        deviceName: input.deviceName.trim().slice(0, 200) || 'Android device',
        platform: input.platform ?? 'ANDROID',
        tokenHash: this.hashToken(token),
      },
      select: {
        id: true,
        ownerId: true,
        platform: true,
        deviceName: true,
        createdAt: true,
      },
    });

    return { session, token };
  }

  async revoke(ownerId: string, sessionId: string) {
    const result = await this.prisma.mobileDeviceSession.updateMany({
      where: { id: sessionId, ownerId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Mobile device session not found.');
    return { ok: true };
  }

  async verifyBearerToken(value: string): Promise<MobileDeviceSessionContext> {
    const token = value.replace(/^Bearer\s+/i, '').trim();
    const sessionId = token.startsWith('mvt_') ? token.split('_')[1] : '';
    if (!sessionId || !token) {
      throw new UnauthorizedException('Mobile token is missing.');
    }

    const session = await this.prisma.mobileDeviceSession.findFirst({
      where: { id: sessionId, revokedAt: null },
      select: {
        id: true,
        ownerId: true,
        platform: true,
        deviceName: true,
        tokenHash: true,
      },
    });
    if (!session) throw new UnauthorizedException('Mobile session is invalid.');

    const expected = Buffer.from(session.tokenHash);
    const actual = Buffer.from(this.hashToken(token));
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedException('Mobile session is invalid.');
    }

    await this.prisma.mobileDeviceSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      id: session.id,
      ownerId: session.ownerId,
      platform: session.platform,
      deviceName: session.deviceName,
    };
  }

  hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
