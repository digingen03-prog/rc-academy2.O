import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  CreateScheduleExceptionDto,
  UpdateScheduleConfigDto,
  GenerateScheduleQueryDto,
} from './dto/schedule.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRoleType, ScheduleDayOfWeek } from '@prisma/client';

@Controller('schedule')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  // ----------------------------------------------------
  // Academy Schedule Configuration (WhatsApp Template, Timezone)
  // ----------------------------------------------------

  @Get('config')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.TEACHER,
    UserRoleType.STAFF,
  )
  async getConfig() {
    return this.scheduleService.getScheduleConfig();
  }

  @Put('config')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async updateConfig(
    @Body() dto: UpdateScheduleConfigDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.scheduleService.updateScheduleConfig(dto, actorId);
  }

  // ----------------------------------------------------
  // Daily Schedule & WhatsApp Message Generation
  // ----------------------------------------------------

  @Get('daily')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.TEACHER,
    UserRoleType.STAFF,
  )
  async getDailySchedule(@Query() query: GenerateScheduleQueryDto) {
    return this.scheduleService.getDailySchedule(query.date, query.groupByBatch);
  }

  // ----------------------------------------------------
  // Daily Exceptions (Cancellations, Substitutions, Special Classes)
  // ----------------------------------------------------

  @Get('exceptions')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.TEACHER,
    UserRoleType.STAFF,
  )
  async getExceptions(@Query('date') date?: string) {
    return this.scheduleService.getExceptions(date);
  }

  @Post('exceptions')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async createException(
    @Body() dto: CreateScheduleExceptionDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.scheduleService.createException(dto, actorId);
  }

  @Delete('exceptions/:id')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async deleteException(
    @Param('id') exceptionId: string,
    @CurrentUser('id') actorId: string,
  ) {
    return this.scheduleService.deleteException(exceptionId, actorId);
  }

  // ----------------------------------------------------
  // Recurring Weekly Timetable
  // ----------------------------------------------------

  @Get()
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.TEACHER,
    UserRoleType.STAFF,
  )
  async getSchedules(
    @Query('dayOfWeek') dayOfWeek?: ScheduleDayOfWeek,
    @Query('classId') classId?: string,
    @Query('batchId') batchId?: string,
    @Query('staffId') staffId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.scheduleService.getSchedules({
      dayOfWeek,
      classId,
      batchId,
      staffId: staffId || teacherId,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Post()
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async createSchedule(
    @Body() dto: CreateScheduleDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.scheduleService.createSchedule(dto, actorId);
  }

  @Put(':id')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async updateSchedule(
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.scheduleService.updateSchedule(id, dto, actorId);
  }

  @Delete(':id')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async deleteSchedule(@Param('id') id: string) {
    return this.scheduleService.deleteSchedule(id);
  }
}
