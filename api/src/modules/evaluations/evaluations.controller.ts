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
import { EvaluationsService } from './evaluations.service';
import {
  CreateSubmissionDto,
  ReviewQuestionEvaluationDto,
  ApproveEvaluationDto,
  RejectSubmissionDto,
} from './dto/create-submission.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRoleType, SubmissionStatus } from '@prisma/client';

@Controller('evaluations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Get('submissions')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async getSubmissions(
    @Query('examinationId') examinationId?: string,
    @Query('studentId') studentId?: string,
    @Query('status') status?: SubmissionStatus,
  ) {
    return this.evaluationsService.getSubmissions({
      examinationId,
      studentId,
      status,
    });
  }

  @Get('submissions/:id')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async getSubmissionById(@Param('id') id: string) {
    return this.evaluationsService.getSubmissionById(id);
  }

  @Post('submissions')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async createSubmission(
    @Body() dto: CreateSubmissionDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.evaluationsService.createSubmission(dto, actorId);
  }

  @Post('submissions/:id/evaluate-ai')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async evaluateWithAI(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
  ) {
    return this.evaluationsService.evaluateWithAI(id, actorId);
  }

  @Patch('submissions/:id/review-answer')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async reviewAnswer(
    @Param('id') id: string,
    @Body() dto: ReviewQuestionEvaluationDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.evaluationsService.reviewAnswer(id, dto, actorId);
  }

  @Post('submissions/:id/approve')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async approveEvaluation(
    @Param('id') id: string,
    @Body() dto: ApproveEvaluationDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.evaluationsService.approveEvaluation(id, dto, actorId);
  }

  @Post('submissions/:id/reject')
  @Roles(UserRoleType.SUPER_ADMIN, UserRoleType.ACADEMY_ADMIN, UserRoleType.TEACHER)
  async rejectSubmission(
    @Param('id') id: string,
    @Body() dto: RejectSubmissionDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.evaluationsService.rejectSubmission(id, dto, actorId);
  }
}
