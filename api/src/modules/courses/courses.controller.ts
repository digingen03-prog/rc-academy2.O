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
import { CoursesService } from './courses.service';
import {
  CreateCourseDto,
  UpdateCourseDto,
  CreateBatchDto,
  UpdateBatchDto,
  CreateSubjectDto,
  UpdateSubjectDto,
} from './dto/course.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRoleType, CourseCategory } from '@prisma/client';

@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.TEACHER,
    UserRoleType.ACCOUNTANT,
    UserRoleType.STAFF,
  )
  async findAll(
    @Query() query: { search?: string; isActive?: boolean; category?: CourseCategory },
  ) {
    return this.coursesService.findAll(query);
  }

  @Get('overview')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.TEACHER,
    UserRoleType.ACCOUNTANT,
    UserRoleType.STAFF,
  )
  async getOverview() {
    return this.coursesService.getOverview();
  }

  @Get('subjects')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.TEACHER,
    UserRoleType.ACCOUNTANT,
    UserRoleType.STAFF,
  )
  async getSubjects(@Query() query: { classId?: string; search?: string }) {
    return this.coursesService.getSubjects(query);
  }

  @Post('bootstrap-standards')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async bootstrapStandards(@CurrentUser('id') actorId: string) {
    return this.coursesService.bootstrapStandards(actorId);
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
    return this.coursesService.findOne(id);
  }

  @Post()
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async create(
    @Body() dto: CreateCourseDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.coursesService.create(dto, actorId);
  }

  @Patch(':id')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.coursesService.update(id, dto, actorId);
  }

  @Patch(':id/status')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async toggleStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @CurrentUser('id') actorId: string,
  ) {
    return this.coursesService.toggleStatus(id, isActive, actorId);
  }

  @Delete(':id')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async deleteCourse(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
  ) {
    return this.coursesService.deleteCourse(id, actorId);
  }

  // --- BATCH ENDPOINTS ---

  @Post(':id/batches')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async createBatch(
    @Param('id') courseId: string,
    @Body() dto: CreateBatchDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.coursesService.createBatch(courseId, dto, actorId);
  }

  @Patch('batches/:batchId')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async updateBatch(
    @Param('batchId') batchId: string,
    @Body() dto: UpdateBatchDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.coursesService.updateBatch(batchId, dto, actorId);
  }

  @Patch('batches/:batchId/status')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async toggleBatchStatus(
    @Param('batchId') batchId: string,
    @Body('isActive') isActive: boolean,
    @CurrentUser('id') actorId: string,
  ) {
    return this.coursesService.toggleBatchStatus(batchId, isActive, actorId);
  }

  @Delete('batches/:batchId')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async deleteBatch(
    @Param('batchId') batchId: string,
    @CurrentUser('id') actorId: string,
  ) {
    return this.coursesService.deleteBatch(batchId, actorId);
  }

  // --- SUBJECT ENDPOINTS ---

  @Post(':id/subjects')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async createSubject(
    @Param('id') courseId: string,
    @Body() dto: CreateSubjectDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.coursesService.createSubject(courseId, dto, actorId);
  }

  @Patch('subjects/:subjectId')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async updateSubject(
    @Param('subjectId') subjectId: string,
    @Body() dto: UpdateSubjectDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.coursesService.updateSubject(subjectId, dto, actorId);
  }

  @Delete('subjects/:subjectId')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async deleteSubject(
    @Param('subjectId') subjectId: string,
    @CurrentUser('id') actorId: string,
  ) {
    return this.coursesService.deleteSubject(subjectId, actorId);
  }
}


