import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { SalaryService } from './salary.service';
import {
  UpdateSalaryConfigDto,
  CreatePayoutDto,
  ProcessPayoutDto,
  ResolveExceptionDto,
  SalaryLedgerQueryDto,
  AccrueFixedSalaryDto,
  AccrueFacultyMonthlySalaryDto,
  CreateSalaryAdjustmentDto,
} from './dto/salary.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRoleType } from '@prisma/client';

@Controller('salary')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalaryController {
  constructor(private readonly salaryService: SalaryService) {}

  // ----------------------------------------------------
  // Configuration
  // ----------------------------------------------------

  @Get('config')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async getConfig() {
    return this.salaryService.getSalaryConfig();
  }

  @Put('config')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async updateConfig(
    @Body() dto: UpdateSalaryConfigDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.salaryService.updateSalaryConfig(dto, actorId);
  }

  // ----------------------------------------------------
  // Academy Finance Dashboard Metrics
  // ----------------------------------------------------

  @Get('revenue-summary')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async getRevenueSummary() {
    return this.salaryService.getAcademyRevenueSummary();
  }

  // ----------------------------------------------------
  // Executive Finance Analytics & Settlements
  // ----------------------------------------------------

  @Get('analytics')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async getFinanceAnalytics(@Query('month') month?: string) {
    return this.salaryService.getFinanceExecutiveAnalytics(month);
  }

  @Get('staff-settlements')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async getStaffSettlementsOverview(@Query('month') month?: string) {
    return this.salaryService.getStaffSettlementsOverview(month);
  }

  @Get('payouts')
  @Roles(UserRoleType.SUPER_ADMIN)
  async getAllPayouts(
    @Query('status') status?: string,
    @Query('staffId') staffId?: string,
  ) {
    return this.salaryService.getAllPayouts({ status, staffId });
  }

  @Post('settle-staff')
  @Roles(UserRoleType.SUPER_ADMIN)
  async settleStaffDirect(
    @Body()
    dto: {
      staffId: string;
      paymentMethod?: string;
      reference?: string;
      notes?: string;
      ledgerIds?: string[];
    },
    @CurrentUser('id') actorId: string,
  ) {
    return this.salaryService.directSettleStaff(dto, actorId);
  }

  // ----------------------------------------------------
  // Salary Ledger Auditing
  // ----------------------------------------------------

  @Get('ledger')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async getLedger(@Query() query: SalaryLedgerQueryDto) {
    return this.salaryService.getSalaryLedger(query);
  }

  // ----------------------------------------------------
  // Staff Consolidated Statement View
  // ----------------------------------------------------

  @Get('staff/:staffId')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.ACCOUNTANT,
    UserRoleType.TEACHER,
    UserRoleType.STAFF,
  )
  async getStaffSalarySummary(
    @Param('staffId') staffId: string,
    @CurrentUser() user: any,
  ) {
    // Non-admin staff can only view their own salary summary
    const isAdminOrAccountant =
      user.roles?.includes(UserRoleType.SUPER_ADMIN) ||
      user.roles?.includes(UserRoleType.ACADEMY_ADMIN) ||
      user.roles?.includes(UserRoleType.ACCOUNTANT);

    if (!isAdminOrAccountant && user.id !== staffId) {
      throw new ForbiddenException('You are not authorized to view this staff member salary statement');
    }

    return this.salaryService.getStaffSalarySummary(staffId);
  }

  // ----------------------------------------------------
  // Staff Payouts
  // ----------------------------------------------------

  @Post('payouts')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async createPayout(
    @Body() dto: CreatePayoutDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.salaryService.createPayout(dto, actorId);
  }

  @Put('payouts/:id')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async processPayout(
    @Param('id') payoutId: string,
    @Body() dto: ProcessPayoutDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.salaryService.processPayout(payoutId, dto, actorId);
  }

  // ----------------------------------------------------
  // Revenue Exceptions / Unallocated Payments
  // ----------------------------------------------------

  @Get('exceptions')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async getExceptions() {
    return this.salaryService.getRevenueExceptions();
  }

  @Put('exceptions/:id')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async resolveException(
    @Param('id') exceptionId: string,
    @Body() dto: ResolveExceptionDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.salaryService.resolveRevenueException(exceptionId, dto, actorId);
  }

  // ----------------------------------------------------
  // Fixed Salary Accrual
  // ----------------------------------------------------

  @Post('accrue-fixed')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async accrueFixed(
    @Body() dto: AccrueFixedSalaryDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.salaryService.accrueFixedSalaries(dto, actorId);
  }

  @Post('accrue-faculty-monthly')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async accrueFacultyMonthly(
    @Body() dto: AccrueFacultyMonthlySalaryDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.salaryService.accrueMonthlyFacultyEntitlements(dto, actorId);
  }

  // ----------------------------------------------------
  // Manual Salary Adjustments (Bonuses, Deductions, Fixes)
  // ----------------------------------------------------

  @Post('adjustments')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async createAdjustment(
    @Body() dto: CreateSalaryAdjustmentDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.salaryService.createSalaryAdjustment(dto, actorId);
  }
}
