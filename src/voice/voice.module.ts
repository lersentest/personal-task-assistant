import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ProjectsModule } from '../projects/projects.module';
import { TasksModule } from '../tasks/tasks.module';
import { TelegramModule } from '../telegram/telegram.module';
import { UsersModule } from '../users/users.module';
import { VoiceCommandService } from './voice-command.service';

@Module({
  imports: [AiModule, ProjectsModule, TasksModule, TelegramModule, UsersModule],
  providers: [VoiceCommandService],
  exports: [VoiceCommandService],
})
export class VoiceModule {}
