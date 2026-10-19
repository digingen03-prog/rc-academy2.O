import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import {
  QuickMarkDto,
  StaffQuickMarkDto,
  CreateSessionDto,
  StartClassSessionDto,
  MarkStudentDto,
  BulkMarkStudentsDto,
  CreateCorrectionDto,
  CloseSessionDto,
  AttendanceHistoryQueryDto,
  StaffAttendanceManualDto,
} from './dto/quick-mark.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRoleType, SessionStatus } from '@prisma/client';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // ----------------------------------------------------
  // CAPACITY STATUS
  // ----------------------------------------------------

  @Get('capacity')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.TEACHER,
    UserRoleType.STAFF,
  )
  async getCapacity() {
    return this.attendanceService.getCapacityStatus();
  }

  // ----------------------------------------------------
  // TODAY'S OVERVIEW & SCHEDULED CLASSES
  // ----------------------------------------------------

  @Get('today')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.TEACHER,
    UserRoleType.STAFF,
  )
  async getTodayOverview(
    @Query('date') date: string | undefined,
    @CurrentUser() user: any,
  ) {
    const isTeacher =
      user.roles?.includes(UserRoleType.TEACHER) &&
      !user.roles?.includes(UserRoleType.SUPER_ADMIN) &&
      !user.roles?.includes(UserRoleType.ACADEMY_ADMIN);

    return this.attendanceService.getTodayClassesAndSessions(user.id, isTeacher, date);
  }

  // ----------------------------------------------------
  // SESSIONS
  // ----------------------------------------------------

  @Get('sessions')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.TEACHER,
    UserRoleType.STAFF,
  )
  async getSessions(
    @Query() query: { batchId?: string; date?: string; status?: SessionStatus },
  ) {
    return this.attendanceService.getSessions(query);
  }

  @Post('sessions')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async createSession(
    @Body() dto: CreateSessionDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.attendanceService.createSession(dto, actorId);
  }

  @Post('sessions/start-class')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async startClassSession(
    @Body() dto: StartClassSessionDto,
    @CurrentUser() user: any,
  ) {
    const isTeacher =
      user.roles?.includes(UserRoleType.TEACHER) &&
      !user.roles?.includes(UserRoleType.SUPER_ADMIN) &&
      !user.roles?.includes(UserRoleType.ACADEMY_ADMIN);

    return this.attendanceService.startClassSession(dto, user.id, isTeacher);
  }

  @Get('sessions/:id')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.TEACHER,
    UserRoleType.STAFF,
  )
  async getSessionById(@Param('id') id: string) {
    return this.attendanceService.getSessionById(id);
  }

  @Patch('sessions/:id/close')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async closeSession(
    @Param('id') id: string,
    @Body() dto: CloseSessionDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.attendanceService.closeSession(id, dto, actorId);
  }

  // ----------------------------------------------------
  // STUDENT ATTENDANCE MARKING
  // ----------------------------------------------------

  @Post('quick-mark')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.TEACHER,
    UserRoleType.STAFF,
  )
  async quickMark(
    @Body() dto: QuickMarkDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.attendanceService.quickMark(dto, actorId);
  }

  @Post('mark-student')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async markStudent(
    @Body() dto: MarkStudentDto,
    @CurrentUser() user: any,
  ) {
    const isTeacher =
      user.roles?.includes(UserRoleType.TEACHER) &&
      !user.roles?.includes(UserRoleType.SUPER_ADMIN) &&
      !user.roles?.includes(UserRoleType.ACADEMY_ADMIN);

    return this.attendanceService.markStudent(dto, user.id, isTeacher);
  }

  @Post('bulk-mark')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async bulkMark(
    @Body() dto: BulkMarkStudentsDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.attendanceService.bulkMark(dto, actorId);
  }

  // ----------------------------------------------------
  // ATTENDANCE HISTORY
  // ----------------------------------------------------

  @Get('history')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.TEACHER,
    UserRoleType.STAFF,
  )
  async getAttendanceHistory(
    @Query() query: AttendanceHistoryQueryDto,
    @CurrentUser() user: any,
  ) {
    const isTeacher =
      user.roles?.includes(UserRoleType.TEACHER) &&
      !user.roles?.includes(UserRoleType.SUPER_ADMIN) &&
      !user.roles?.includes(UserRoleType.ACADEMY_ADMIN);

    return this.attendanceService.getAttendanceHistory(query, user.id, isTeacher);
  }

  // ----------------------------------------------------
  // CORRECTIONS
  // ----------------------------------------------------

  @Post('corrections')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async createCorrection(
    @Body() dto: CreateCorrectionDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.attendanceService.createCorrection(dto, actorId);
  }

  // ----------------------------------------------------
  // STAFF ATTENDANCE
  // ----------------------------------------------------

  @Post('staff/quick-mark')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.TEACHER,
    UserRoleType.STAFF,
  )
  async staffQuickMark(
    @Body() dto: StaffQuickMarkDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.attendanceService.staffQuickMark(dto, actorId);
  }

  @Get('staff/records')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.TEACHER,
    UserRoleType.STAFF,
  )
  async getStaffRecords(
    @Query('date') date?: string,
    @Query('userId') userId?: string,
  ) {
    return this.attendanceService.getStaffAttendanceRecords({ date, userId });
  }

  @Post('staff/manual')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async manualStaffRecord(
    @Body() dto: StaffAttendanceManualDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.attendanceService.manualStaffRecord(dto, actorId);
  }

  // ----------------------------------------------------
  // REPORTS
  // ----------------------------------------------------

  @Get('reports/batch')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.TEACHER,
    UserRoleType.STAFF,
  )
  async getBatchReport(
    @Query('batchId') batchId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.attendanceService.getBatchAttendanceReport(batchId, startDate, endDate);
  }

  @Get('reports/student/:studentId')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.TEACHER,
    UserRoleType.STAFF,
  )
  async getStudentReport(@Param('studentId') studentId: string) {
    return this.attendanceService.getStudentAttendanceHistory(studentId);
  }
}
