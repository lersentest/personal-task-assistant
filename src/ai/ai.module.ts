import { Module } from '@nestjs/common';
import { AiCommandService } from './ai-command.service';

@Module({
  providers: [AiCommandService],
  exports: [AiCommandService],
})
export class AiModule {}
