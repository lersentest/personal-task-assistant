import { Module } from '@nestjs/common';
import { AiAnalyticsService } from './ai-analytics.service';
import { AnalyticsSqlService } from './analytics-sql.service';

@Module({
  providers: [AiAnalyticsService, AnalyticsSqlService],
  exports: [AiAnalyticsService],
})
export class AiAnalyticsModule {}
