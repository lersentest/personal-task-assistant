import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(nodeScrypt);
const KEY_LENGTH = 64;

@Injectable()
export class PasswordService {
  assertPasswordPolicy(password: string) {
    if (password.length < 10) {
      throw new BadRequestException('Password must contain at least 10 characters.');
    }
    if (password.length > 256) {
      throw new BadRequestException('Password is too long.');
    }
  }

  async hashPassword(password: string) {
    this.assertPasswordPolicy(password);
    const salt = randomBytes(16).toString('base64url');
    const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
    return `scrypt:v1:${salt}:${derived.toString('base64url')}`;
  }

  async verifyPassword(password: string, storedHash: string | null | undefined) {
    if (!storedHash) throw new UnauthorizedException('Invalid email or password.');
    const [algorithm, version, salt, hash] = storedHash.split(':');
    if (algorithm !== 'scrypt' || version !== 'v1' || !salt || !hash) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    const expected = Buffer.from(hash, 'base64url');
    const actual = (await scrypt(password, salt, expected.length)) as Buffer;
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedException('Invalid email or password.');
    }
  }
}
