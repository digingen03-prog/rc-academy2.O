import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, UpdateExpenseDto, RejectExpenseDto, QueryExpenseDto } from './dto/expense.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRoleType } from '@prisma/client';

@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  /**
   * POST /expenses
   * Add a new expense with optional proof receipt file.
   * Admin / Accountant / Super Admin can add expenses.
   */
  @Post()
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  @UseInterceptors(FileInterceptor('proof'))
  async create(
    @Body() dto: CreateExpenseDto,
    @UploadedFile() file: any,
    @CurrentUser() user: any,
  ) {
    return this.expensesService.createExpense(dto, file, user);
  }

  /**
   * GET /expenses
   * Query expenses with filters, search, and KPI summary.
   */
  @Get()
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async findAll(@Query() query: QueryExpenseDto, @CurrentUser() user: any) {
    return this.expensesService.findAll(query, user);
  }

  /**
   * GET /expenses/proofs/local-file
   * Streams local proof attachment if local storage driver is active.
   */
  @Get('proofs/local-file')
  async getLocalProofFile(@Query('key') key: string, @Res() res: Response) {
    const { buffer, mimeType } = this.expensesService.getS3StorageService().getLocalFileBuffer(key);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', 'inline');
    res.send(buffer);
  }

  /**
   * GET /expenses/:id
   */
  @Get(':id')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async findOne(@Param('id') id: string) {
    return this.expensesService.findOne(id);
  }

  /**
   * PATCH /expenses/:id
   * Update expense fields.
   */
  @Patch(':id')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() user: any,
  ) {
    return this.expensesService.updateExpense(id, dto, user);
  }

  /**
   * PATCH /expenses/:id/approve
   * Super Admin approves the expense.
   * Once approved, it is calculated in /finance-analytics.
   */
  @Patch(':id/approve')
  @Roles(UserRoleType.SUPER_ADMIN)
  async approve(@Param('id') id: string, @CurrentUser() user: any) {
    return this.expensesService.approveExpense(id, user);
  }

  /**
   * PATCH /expenses/:id/reject
   * Super Admin rejects the expense.
   */
  @Patch(':id/reject')
  @Roles(UserRoleType.SUPER_ADMIN)
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectExpenseDto,
    @CurrentUser() user: any,
  ) {
    return this.expensesService.rejectExpense(id, dto.reason, user);
  }

  /**
   * POST /expenses/:id/proof
   * Upload or replace proof attachment.
   */
  @Post(':id/proof')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  @UseInterceptors(FileInterceptor('proof'))
  async uploadProof(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('A file is required for proof attachment');
    }
    return this.expensesService.uploadProof(id, file, user);
  }

  /**
   * GET /expenses/:id/proof-url
   * Get presigned or download URL for expense proof attachment.
   */
  @Get(':id/proof-url')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.ACCOUNTANT)
  async getProofUrl(@Param('id') id: string, @CurrentUser() user: any) {
    return this.expensesService.getProofUrl(id, user);
  }

  /**
   * DELETE /expenses/:id
   * Delete expense entry.
   */
  @Delete(':id')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.expensesService.deleteExpense(id, user);
  }
}

