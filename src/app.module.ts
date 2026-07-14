import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AiModule } from './ai/ai.module';
import { ApiModule } from './api/api.module';
import { AutomationModule } from './automation/automation.module';
import { validateEnvironment } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { ProjectsModule } from './projects/projects.module';
import { RemindersModule } from './reminders/reminders.module';
import { MyDayModule } from './my-day/my-day.module';
import { TagsModule } from './tags/tags.module';
import { TasksModule } from './tasks/tasks.module';
import { TelegramModule } from './telegram/telegram.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    ApiModule,
    AiModule,
    UsersModule,
    ProjectsModule,
    TasksModule,
    MyDayModule,
    TagsModule,
    RemindersModule,
    TelegramModule,
    AutomationModule,
  ],
})
export class AppModule {}
