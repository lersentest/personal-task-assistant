import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AiAnalyticsModule } from '../ai-analytics/ai-analytics.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { AttachmentsController } from './attachments.controller';
import { AiAnalyticsController } from './ai-analytics.controller';
import { DashboardController } from './dashboard.controller';
import { DelegatedTasksController } from './delegated-tasks.controller';
import { ExecutorsController } from './executors.controller';
import { MyDayController } from './my-day.controller';
import { MobileAuthController } from './mobile-auth.controller';
import { NewsController } from './news.controller';
import { ProjectsController } from './projects.controller';
import { PublicDelegatedTasksController } from './public-delegated-tasks.controller';
import { TagsController } from './tags.controller';
import { TasksController } from './tasks.controller';
import { VoiceController } from './voice.controller';
import { VoiceCommandController } from './voice-command.controller';
import { AuthController } from './auth.controller';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { DelegatedTasksModule } from '../delegated-tasks/delegated-tasks.module';
import { ExecutorsModule } from '../executors/executors.module';
import { MyDayModule } from '../my-day/my-day.module';
import { NewsModule } from '../news/news.module';
import { MobileAuthModule } from '../mobile-auth/mobile-auth.module';
import { RemindersModule } from '../reminders/reminders.module';
import { TagsModule } from '../tags/tags.module';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';
import { VoiceModule } from '../voice/voice.module';

@Module({
  imports: [
    AiModule,
    AiAnalyticsModule,
    UsersModule,
    TasksModule,
    ProjectsModule,
    TagsModule,
    RemindersModule,
    AttachmentsModule,
    ExecutorsModule,
    DelegatedTasksModule,
    MyDayModule,
    NewsModule,
    MobileAuthModule,
    VoiceModule,
    AuthModule,
  ],
  controllers: [
    AuthController,
    DashboardController,
    AiAnalyticsController,
    MyDayController,
    ExecutorsController,
    DelegatedTasksController,
    PublicDelegatedTasksController,
    TasksController,
    ProjectsController,
    TagsController,
    AttachmentsController,
    MobileAuthController,
    NewsController,
    VoiceController,
    VoiceCommandController,
  ],
})
export class ApiModule {}
