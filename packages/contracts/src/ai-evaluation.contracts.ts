import { ReviewCategoryEnum, SubmissionStatusEnum } from './enums.js';

export interface RubricCriterionDto {
  name: string;
  weight: number;
  description: string;
}

export interface CriterionScoreDto {
  criterion: string;
  allocatedMarks: number;
  obtainedMarks: number;
  feedback: string;
}

export interface AIEvaluationRequestDto {
  submissionId: string;
  questionId: string;
  questionText: string;
  questionType: string;
  maxMarks: number;
  markingRubric: Record<string, RubricCriterionDto>;
  answerKey: string;
  studentAnswerRawText: string;
  confidenceThreshold?: number;
}

export interface AIEvaluationResultItemDto {
  submissionId: string;
  questionId: string;
  extractedAnswerText: string;
  ocrQualityScore: number;
  suggestedMarks: number;
  maxMarks: number;
  criterionLevelScores: CriterionScoreDto[];
  missingConcepts: string[];
  incorrectConcepts: string[];
  explanation: string;
  confidence: number;
  reviewCategory: ReviewCategoryEnum;
  modelName: string;
}

export interface TeacherReviewSubmissionDto {
  evaluationId: string;
  finalMarks: number;
  overrideFeedback?: string;
  isApproved: boolean;
}

export interface SubmissionDetailsDto {
  id: string;
  examinationId: string;
  examinationTitle: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  status: SubmissionStatusEnum;
  uploadedAt: string;
  fileUrl?: string;
  evaluations: AIEvaluationResultItemDto[];
  totalSuggestedMarks?: number;
  totalFinalMarks?: number;
}
