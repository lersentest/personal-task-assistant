import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { NewsService } from './news.service';

@Module({
  imports: [DatabaseModule],
  providers: [NewsService],
  exports: [NewsService],
})
export class NewsModule {}
