import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AiAnalyticsModule } from '../ai-analytics/ai-analytics.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { AttachmentsController } from './attachments.controller';
import { AuditAccessController } from './audit-access.controller';
import { AuditAccessModule } from '../audit-access/audit-access.module';
import { AiAnalyticsController } from './ai-analytics.controller';
import { DashboardController } from './dashboard.controller';
import { DelegatedTasksController } from './delegated-tasks.controller';
import { ExecutorsController } from './executors.controller';
import { MyDayController } from './my-day.controller';
import { ProjectsController } from './projects.controller';
import { PublicDelegatedTasksController } from './public-delegated-tasks.controller';
import { TagsController } from './tags.controller';
import { TasksController } from './tasks.controller';
import { VoiceController } from './voice.controller';
import { ProjectsModule } from '../projects/projects.module';
import { DelegatedTasksModule } from '../delegated-tasks/delegated-tasks.module';
import { ExecutorsModule } from '../executors/executors.module';
import { MyDayModule } from '../my-day/my-day.module';
import { RemindersModule } from '../reminders/reminders.module';
import { TagsModule } from '../tags/tags.module';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';
import { VoiceModule } from '../voice/voice.module';

@Module({
  imports: [
    AiModule,
    AiAnalyticsModule,
    AuditAccessModule,
    UsersModule,
    TasksModule,
    ProjectsModule,
    TagsModule,
    RemindersModule,
    AttachmentsModule,
    ExecutorsModule,
    DelegatedTasksModule,
    MyDayModule,
    VoiceModule,
  ],
  controllers: [
    DashboardController,
    AuditAccessController,
    AiAnalyticsController,
    MyDayController,
    ExecutorsController,
    DelegatedTasksController,
    PublicDelegatedTasksController,
    TasksController,
    ProjectsController,
    TagsController,
    AttachmentsController,
    VoiceController,
  ],
})
export class ApiModule {}
