import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MobileAuthService } from './mobile-auth.service';

@Module({
  imports: [DatabaseModule],
  providers: [MobileAuthService],
  exports: [MobileAuthService],
})
export class MobileAuthModule {}
