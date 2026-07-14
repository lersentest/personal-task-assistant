import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { RemindersService } from './reminders.service';

@Module({
  imports: [TasksModule],
  providers: [RemindersService],
  exports: [RemindersService],
})
export class RemindersModule {}
