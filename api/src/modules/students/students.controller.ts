import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { StudentsService } from './students.service';
import {
  CreateStudentDto,
  UpdateStudentDto,
  EnrollStudentDto,
  BulkValidateDto,
  BulkImportDto,
} from './dto/create-student.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRoleType } from '@prisma/client';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.TEACHER,
    UserRoleType.ACCOUNTANT,
    UserRoleType.STAFF,
  )
  async findAll(
    @Query()
    query: {
      search?: string;
      batchId?: string;
      classId?: string;
      page?: number;
      limit?: number;
    },
  ) {
    return this.studentsService.findAll(query);
  }

  @Get('csv-template')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.STAFF)
  async downloadTemplate(@Res() res: Response) {
    const template = this.studentsService.getCsvTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${template.filename}"`,
    );
    return res.send(template.content);
  }

  @Post('bulk-validate')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async bulkValidate(@Body() dto: BulkValidateDto) {
    return this.studentsService.bulkValidate(dto);
  }

  @Post('bulk-import')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async bulkImport(
    @Body() dto: BulkImportDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.studentsService.bulkImport(dto, actorId);
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
    return this.studentsService.findOne(id);
  }

  @Post()
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async create(
    @Body() createDto: CreateStudentDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.studentsService.create(createDto, actorId);
  }

  @Patch(':id')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateStudentDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.studentsService.update(id, updateDto, actorId);
  }

  @Post(':id/enroll')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async enroll(
    @Param('id') id: string,
    @Body() enrollDto: EnrollStudentDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.studentsService.enrollInBatch(id, enrollDto, actorId);
  }

  @Get(':id/enrollments')
  @Roles(
    UserRoleType.SUPER_ADMIN,
    UserRoleType.ACADEMY_ADMIN,
    UserRoleType.TEACHER,
    UserRoleType.ACCOUNTANT,
    UserRoleType.STAFF,
  )
  async getEnrollments(@Param('id') id: string) {
    return this.studentsService.getStudentEnrollments(id);
  }

  @Delete(':id/enrollments/:enrollmentId')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async deactivateEnrollment(
    @Param('id') id: string,
    @Param('enrollmentId') enrollmentId: string,
    @CurrentUser('id') actorId: string,
  ) {
    return this.studentsService.deactivateEnrollment(id, enrollmentId, actorId);
  }

  @Delete(':id')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
  ) {
    return this.studentsService.remove(id, actorId);
  }
}


