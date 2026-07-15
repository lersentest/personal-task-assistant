import { Module } from '@nestjs/common';
import { DelegatedTasksModule } from '../delegated-tasks/delegated-tasks.module';
import { RemindersModule } from '../reminders/reminders.module';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';
import { AutomationService } from './automation.service';

@Module({
  imports: [DelegatedTasksModule, RemindersModule, TasksModule, UsersModule],
  providers: [AutomationService],
})
export class AutomationModule {}
