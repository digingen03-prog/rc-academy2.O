import { DifficultyLevelEnum, ExaminationStatusEnum, QuestionTypeEnum } from './enums.js';

export interface QuestionOptionDto {
  key: string; // e.g. "A", "B", "C", "D"
  text: string;
  isCorrect: boolean;
}

export interface QuestionDto {
  id?: string;
  subjectId: string;
  subjectName?: string;
  topic: string;
  questionType: QuestionTypeEnum;
  difficulty: DifficultyLevelEnum;
  content: string;
  maxMarks: number;
  options?: QuestionOptionDto[];
  answerKeyText?: string;
  markingRubricJson?: Record<string, unknown>;
}

export interface ExaminationDto {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  date: string;
  totalMarks: number;
  durationMinutes: number;
  status: ExaminationStatusEnum;
  questionsCount?: number;
  submissionsCount?: number;
}

export interface CreateExaminationDto {
  title: string;
  subjectId: string;
  classId: string;
  date: string;
  totalMarks: number;
  durationMinutes: number;
  questions?: QuestionDto[];
}

export interface BlueprintTopicConfigDto {
  topic: string;
  questionCount: number;
  marks: number;
}

export interface PaperBlueprintConfigDto {
  examinationId: string;
  topics: BlueprintTopicConfigDto[];
  difficultyDistribution: {
    easyPercentage: number;
    mediumPercentage: number;
    hardPercentage: number;
  };
  totalMarks: number;
  includeAnswerKey: boolean;
}
