import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ExecutorsService } from './executors.service';

@Module({
  imports: [DatabaseModule],
  providers: [ExecutorsService],
  exports: [ExecutorsService],
})
export class ExecutorsModule {}
