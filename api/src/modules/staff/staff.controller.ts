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
} from '@nestjs/common';
import { StaffService } from './staff.service';
import {
  CreateStaffDto,
  UpdateStaffDto,
  AssignStaffCoursesDto,
} from './dto/staff.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRoleType, UserStatus } from '@prisma/client';

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.TEACHER,
    UserRoleType.ACCOUNTANT,
    UserRoleType.STAFF,
  )
  async findAll(
    @Query() query: { search?: string; role?: string; status?: UserStatus },
  ) {
    return this.staffService.findAll(query);
  }

  @Get(':id')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.TEACHER,
    UserRoleType.ACCOUNTANT,
    UserRoleType.STAFF,
  )
  async findOne(@Param('id') id: string) {
    return this.staffService.findOne(id);
  }

  @Post()
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async create(
    @Body() dto: CreateStaffDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.staffService.create(dto, actorId);
  }

  @Patch(':id')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.staffService.update(id, dto, actorId);
  }

  @Post(':id/assignments')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async assignCourses(
    @Param('id') id: string,
    @Body() dto: AssignStaffCoursesDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.staffService.assignCourses(id, dto, actorId);
  }

  @Patch(':id/assignments/:assignmentId')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async updateAssignment(
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: any,
    @CurrentUser('id') actorId: string,
  ) {
    return this.staffService.updateAssignment(id, assignmentId, dto, actorId);
  }

  @Delete(':id/assignments/:assignmentId')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async removeAssignment(
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @CurrentUser('id') actorId: string,
  ) {
    return this.staffService.removeAssignment(id, assignmentId, actorId);
  }

  @Delete(':id')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
  ) {
    return this.staffService.remove(id, actorId);
  }
}
