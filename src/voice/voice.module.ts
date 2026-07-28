import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ProjectsModule } from '../projects/projects.module';
import { TasksModule } from '../tasks/tasks.module';
import { TelegramModule } from '../telegram/telegram.module';
import { UsersModule } from '../users/users.module';
import { DatabaseModule } from '../database/database.module';
import { MobileVoiceCommandService } from './mobile-voice-command.service';
import { VoiceCommandService } from './voice-command.service';

@Module({
  imports: [
    AiModule,
    DatabaseModule,
    ProjectsModule,
    TasksModule,
    TelegramModule,
    UsersModule,
  ],
  providers: [VoiceCommandService, MobileVoiceCommandService],
  exports: [VoiceCommandService, MobileVoiceCommandService],
})
export class VoiceModule {}
