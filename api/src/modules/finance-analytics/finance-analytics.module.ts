import { Module } from '@nestjs/common';
import { FinanceAnalyticsController } from './finance-analytics.controller';
import { FinanceAnalyticsService } from './finance-analytics.service';

@Module({
  controllers: [FinanceAnalyticsController],
  providers: [FinanceAnalyticsService],
  exports: [FinanceAnalyticsService],
})
export class FinanceAnalyticsModule {}

