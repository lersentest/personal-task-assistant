import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TasksModule } from '../tasks/tasks.module';
import { MyDayService } from './my-day.service';

@Module({
  imports: [DatabaseModule, TasksModule],
  providers: [MyDayService],
  exports: [MyDayService],
})
export class MyDayModule {}
