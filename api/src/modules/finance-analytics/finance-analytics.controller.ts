import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { FinanceAnalyticsService } from './finance-analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRoleType } from '@prisma/client';

@Controller('finance-analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceAnalyticsController {
  constructor(private readonly analyticsService: FinanceAnalyticsService) {}

  /**
   * GET /finance-analytics/staff-settlements?month=YYYY-MM
   * Aggregated staff settlements breakdown by tier, entitlement, realized and pending.
   */
  @Get('staff-settlements')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.ACCOUNTANT,
  )
  async getStaffSettlements(@Query('month') month?: string) {
    return this.analyticsService.getStaffSettlements(month || '');
  }

  /**
   * GET /finance-analytics/staff-settlements/:staffId/history?month=YYYY-MM
   * Chronological settlement timeline, monotonic running total, and per-student details.
   */
  @Get('staff-settlements/:staffId/history')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.ACCOUNTANT,
  )
  async getStaffSettlementHistory(
    @Param('staffId') staffId: string,
    @Query('month') month?: string,
    @CurrentUser('id') viewerId?: string,
  ) {
    return this.analyticsService.getStaffSettlementHistory(
      staffId,
      month || '',
      viewerId,
    );
  }
}

