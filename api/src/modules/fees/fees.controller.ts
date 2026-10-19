import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { FeesService } from './fees.service';
import {
  RecordPaymentDto,
  CreateInvoiceDto,
  CreateFeePlanDto,
  ReversePaymentDto,
} from './dto/record-payment.dto';
import {
  CreateCourseFeeConfigDto,
  UpdateCourseFeeConfigDto,
  CreateCourseInvoiceDto,
  ApplyFeeAdjustmentDto,
} from './dto/course-fee.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRoleType, InvoiceStatus, PaymentStatus } from '@prisma/client';

@Controller('fees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeesController {
  constructor(private readonly feesService: FeesService) {}

  // ----------------------------------------------------
  // Finance Dashboard Summary & Real Metrics
  // ----------------------------------------------------

  @Get('dashboard-summary')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.ACCOUNTANT,
    UserRoleType.TEACHER,
  )
  async getDashboardSummary() {
    return this.feesService.getFinanceDashboardSummary();
  }

  // ----------------------------------------------------
  // Course Fee Configurations
  // ----------------------------------------------------

  @Get('course-configs')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.ACCOUNTANT,
    UserRoleType.TEACHER,
  )
  async getCourseFeeConfigs(
    @Query('academicYearId') academicYearId?: string,
    @Query('classId') classId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('batchId') batchId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.feesService.getCourseFeeConfigs({
      academicYearId,
      classId,
      subjectId,
      batchId,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get('course-configs/:id')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.ACCOUNTANT,
    UserRoleType.TEACHER,
  )
  async getCourseFeeConfigById(@Param('id') id: string) {
    return this.feesService.getCourseFeeConfigById(id);
  }

  @Post('course-configs')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async createCourseFeeConfig(
    @Body() dto: CreateCourseFeeConfigDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.feesService.createCourseFeeConfig(dto, actorId);
  }

  @Patch('course-configs/:id')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async updateCourseFeeConfig(
    @Param('id') id: string,
    @Body() dto: UpdateCourseFeeConfigDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.feesService.updateCourseFeeConfig(id, dto, actorId);
  }

  @Post('course-configs/:id/replicate')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async replicateCourseFeeConfig(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
  ) {
    return this.feesService.replicateFeeConfigToStudents(id, actorId);
  }

  // ----------------------------------------------------
  // Student Consolidated Fee Accounts
  // ----------------------------------------------------

  @Get('student-accounts')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.ACCOUNTANT,
    UserRoleType.TEACHER,
  )
  async getConsolidatedStudentAccounts(
    @Query('search') search?: string,
    @Query('classId') classId?: string,
    @Query('batchId') batchId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.feesService.getConsolidatedStudentAccounts({
      search,
      classId,
      batchId,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('students/:studentId/account')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.ACCOUNTANT,
    UserRoleType.TEACHER,
    UserRoleType.STAFF,
  )
  async getStudentFeeAccount(@Param('studentId') studentId: string) {
    return this.feesService.getStudentFeeAccount(studentId);
  }

  // ----------------------------------------------------
  // Course Invoices & Obligations
  // ----------------------------------------------------

  @Post('course-invoices')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async createCourseInvoice(
    @Body() dto: CreateCourseInvoiceDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.feesService.createCourseInvoice(dto, actorId);
  }

  @Post('enrollments/:enrollmentId/bill')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async createCourseInvoiceForEnrollment(
    @Param('enrollmentId') enrollmentId: string,
    @Query('billingPeriod') billingPeriod?: string,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.feesService.createCourseInvoiceForEnrollment(
      enrollmentId,
      billingPeriod || 'ANNUAL',
      actorId,
    );
  }

  // ----------------------------------------------------
  // Fee Adjustments & Discounts
  // ----------------------------------------------------

  @Post('adjustments')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async applyFeeAdjustment(
    @Body() dto: ApplyFeeAdjustmentDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.feesService.applyFeeAdjustment(dto, actorId);
  }

  // ----------------------------------------------------
  // Legacy Fee Plans (Preserved)
  // ----------------------------------------------------

  @Get('plans')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT, UserRoleType.TEACHER)
  async getFeePlans(@Query('academicYearId') academicYearId?: string) {
    return this.feesService.getFeePlans(academicYearId);
  }

  @Post('plans')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async createFeePlan(@Body() dto: CreateFeePlanDto) {
    return this.feesService.createFeePlan(dto);
  }

  // ----------------------------------------------------
  // Invoices
  // ----------------------------------------------------

  @Get('invoices')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT, UserRoleType.TEACHER)
  async getInvoices(
    @Query() query: { studentId?: string; status?: InvoiceStatus; classId?: string },
  ) {
    return this.feesService.getInvoices(query);
  }

  @Get('invoices/:id')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT, UserRoleType.TEACHER)
  async getInvoiceById(@Param('id') id: string) {
    return this.feesService.getInvoiceById(id);
  }

  @Post('invoices')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.feesService.createInvoice(dto);
  }

  // ----------------------------------------------------
  // Payments & Receipts
  // ----------------------------------------------------

  @Get('payments')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async getPayments(@Query() query: { studentId?: string; status?: PaymentStatus }) {
    return this.feesService.getPayments(query);
  }

  @Get('payments/:id')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async getPaymentById(@Param('id') id: string) {
    return this.feesService.getPaymentById(id);
  }

  @Get('payments/:id/receipt')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.ACCOUNTANT,
    UserRoleType.TEACHER,
    UserRoleType.STAFF,
  )
  async getReceipt(@Param('id') id: string) {
    return this.feesService.getReceipt(id);
  }

  @Post('payments')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async recordPayment(@Body() dto: RecordPaymentDto, @CurrentUser('id') actorId: string) {
    return this.feesService.recordPayment(dto, actorId);
  }

  @Post('payments/:id/reverse')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async reversePayment(
    @Param('id') id: string,
    @Body() dto: ReversePaymentDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.feesService.reversePayment(id, dto, actorId);
  }

  // ----------------------------------------------------
  // Reports
  // ----------------------------------------------------

  @Get('outstanding')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async getOutstandingReport() {
    return this.feesService.getOutstandingReport();
  }

  @Get('reconciliation')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async getReconciliationReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.feesService.getReconciliationReport(startDate, endDate);
  }
}
