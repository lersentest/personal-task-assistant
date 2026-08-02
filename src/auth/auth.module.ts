import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MobileAuthModule } from '../mobile-auth/mobile-auth.module';
import { PasswordService } from './password.service';
import { WebAuthService } from './web-auth.service';

@Module({
  imports: [DatabaseModule, MobileAuthModule],
  providers: [PasswordService, WebAuthService],
  exports: [PasswordService, WebAuthService],
})
export class AuthModule {}
