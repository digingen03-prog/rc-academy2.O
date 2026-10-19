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
import { ExaminationsService } from './examinations.service';
import {
  CreateExaminationDto,
  UpdateExaminationDto,
  CreateQuestionDto,
  UpdateQuestionDto,
  ConfigurePaperDto,
  GenerateAIQuestionsDto,
  RecordExamAttendanceDto,
  SubmitMarksDto,
  CorrectResultDto,
} from './dto/create-exam.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  UserRoleType,
  ExaminationStatus,
  QuestionStatus,
  DifficultyLevel,
  QuestionType,
} from '@prisma/client';

@Controller('examinations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExaminationsController {
  constructor(private readonly examinationsService: ExaminationsService) {}

  // ----------------------------------------------------
  // 1. QUESTION BANK
  // ----------------------------------------------------

  @Get('questions')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async getQuestions(
    @Query('subjectId') subjectId?: string,
    @Query('topic') topic?: string,
    @Query('difficulty') difficulty?: DifficultyLevel,
    @Query('questionType') questionType?: QuestionType,
    @Query('status') status?: QuestionStatus,
    @Query('search') search?: string,
  ) {
    return this.examinationsService.getQuestions({
      subjectId,
      topic,
      difficulty,
      questionType,
      status,
      search,
    });
  }

  @Get('questions/:id')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async getQuestionById(@Param('id') id: string) {
    return this.examinationsService.getQuestionById(id);
  }

  @Post('questions')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async createQuestion(@Body() dto: CreateQuestionDto, @CurrentUser('id') actorId: string) {
    return this.examinationsService.createQuestion(dto, actorId);
  }

  @Patch('questions/:id')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async updateQuestion(@Param('id') id: string, @Body() dto: UpdateQuestionDto) {
    return this.examinationsService.updateQuestion(id, dto);
  }

  @Delete('questions/:id')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async deleteQuestion(@Param('id') id: string) {
    return this.examinationsService.deleteQuestion(id);
  }

  // ----------------------------------------------------
  // 2. EXAMINATIONS
  // ----------------------------------------------------

  @Get()
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async findAll(
    @Query('classId') classId?: string,
    @Query('batchId') batchId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('status') status?: ExaminationStatus,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.examinationsService.findAll({
      classId,
      batchId,
      subjectId,
      status,
      academicYearId,
    });
  }

  @Get(':id')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async findOne(@Param('id') id: string) {
    return this.examinationsService.findOne(id);
  }

  @Post()
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async create(@Body() dto: CreateExaminationDto) {
    return this.examinationsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateExaminationDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.examinationsService.update(id, dto, actorId);
  }

  @Patch(':id/status')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: ExaminationStatus,
    @CurrentUser('id') actorId: string,
  ) {
    return this.examinationsService.updateStatus(id, status, actorId);
  }

  // ----------------------------------------------------
  // 3. QUESTION PAPER BUILDER
  // ----------------------------------------------------

  @Post(':id/paper')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async configurePaper(@Param('id') id: string, @Body() dto: ConfigurePaperDto) {
    return this.examinationsService.configurePaper(id, dto);
  }

  @Post(':id/paper/publish')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async publishPaper(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.examinationsService.publishPaper(id, actorId);
  }

  @Get(':id/paper')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async getPaper(@Param('id') id: string) {
    return this.examinationsService.getPaper(id);
  }

  // ----------------------------------------------------
  // 4. LOCAL AI QUESTION GENERATION
  // ----------------------------------------------------

  @Post('ai/generate-questions')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async generateAIQuestions(
    @Body() dto: GenerateAIQuestionsDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.examinationsService.generateAIQuestions(dto, actorId);
  }

  // ----------------------------------------------------
  // 5. CANDIDATES & ATTENDANCE
  // ----------------------------------------------------

  @Get(':id/candidates')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async getCandidates(@Param('id') id: string) {
    return this.examinationsService.getCandidates(id);
  }

  @Post(':id/attendance')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async recordAttendance(
    @Param('id') id: string,
    @Body() dto: RecordExamAttendanceDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.examinationsService.recordAttendance(examIdFrom(id), dto, actorId);
  }

  // ----------------------------------------------------
  // 6. MARKS & RESULTS
  // ----------------------------------------------------

  @Post(':id/marks')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async submitMarks(
    @Param('id') id: string,
    @Body() dto: SubmitMarksDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.examinationsService.submitMarks(id, dto, actorId);
  }

  @Post(':id/results/finalize')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async finalizeResults(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.examinationsService.finalizeResults(id, actorId);
  }

  @Post(':id/results/correct')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN)
  async correctResult(
    @Param('id') id: string,
    @Body() dto: CorrectResultDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.examinationsService.correctResult(id, dto, actorId);
  }

  @Get(':id/results')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER, UserRoleType.ACCOUNTANT)
  async getResults(@Param('id') id: string) {
    return this.examinationsService.getResults(id);
  }
}

function examIdFrom(id: string): string {
  return id;
}
