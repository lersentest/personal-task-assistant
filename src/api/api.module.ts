import { Module } from '@nestjs/common';
import { AttachmentsModule } from '../attachments/attachments.module';
import { AttachmentsController } from './attachments.controller';
import { DashboardController } from './dashboard.controller';
import { MyDayController } from './my-day.controller';
import { ProjectsController } from './projects.controller';
import { TagsController } from './tags.controller';
import { TasksController } from './tasks.controller';
import { ProjectsModule } from '../projects/projects.module';
import { MyDayModule } from '../my-day/my-day.module';
import { RemindersModule } from '../reminders/reminders.module';
import { TagsModule } from '../tags/tags.module';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    TasksModule,
    ProjectsModule,
    TagsModule,
    RemindersModule,
    AttachmentsModule,
    MyDayModule,
  ],
  controllers: [
    DashboardController,
    MyDayController,
    TasksController,
    ProjectsController,
    TagsController,
    AttachmentsController,
  ],
})
export class ApiModule {}
