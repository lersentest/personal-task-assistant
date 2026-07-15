import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { DelegatedTasksModule } from '../delegated-tasks/delegated-tasks.module';
import { ExecutorsModule } from '../executors/executors.module';
import { ProjectsModule } from '../projects/projects.module';
import { RemindersModule } from '../reminders/reminders.module';
import { TagsModule } from '../tags/tags.module';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';
import { ConfirmationService } from './confirmation.service';
import { DraftsService } from './drafts.service';
import { TelegramAccessService } from './telegram-access.service';
import { TelegramStateService } from './telegram-state.service';
import { TelegramService } from './telegram.service';
import { TextCommandParserService } from './text-command-parser.service';

@Module({
  imports: [
    UsersModule,
    ExecutorsModule,
    DelegatedTasksModule,
    ProjectsModule,
    TasksModule,
    TagsModule,
    RemindersModule,
    AiModule,
  ],
  providers: [
    TelegramService,
    TelegramAccessService,
    TelegramStateService,
    TextCommandParserService,
    DraftsService,
    ConfirmationService,
  ],
  exports: [DraftsService, ConfirmationService, TextCommandParserService],
})
export class TelegramModule {}
