import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { ExecutorsModule } from '../executors/executors.module';
import { ProjectsModule } from '../projects/projects.module';
import { DelegatedTasksService } from './delegated-tasks.service';

@Module({
  imports: [ConfigModule, DatabaseModule, ExecutorsModule, ProjectsModule],
  providers: [DelegatedTasksService],
  exports: [DelegatedTasksService],
})
export class DelegatedTasksModule {}
