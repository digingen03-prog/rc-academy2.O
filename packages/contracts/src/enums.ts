export enum UserRoleEnum {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ACADEMY_ADMIN = 'ACADEMY_ADMIN',
  TEACHER = 'TEACHER',
  ACCOUNTANT = 'ACCOUNTANT',
  STAFF = 'STAFF'
}

export enum UserStatusEnum {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED'
}

export enum StudentStatusEnum {
  ACTIVE = 'ACTIVE',
  ALUMNI = 'ALUMNI',
  WITHDRAWN = 'WITHDRAWN',
  SUSPENDED = 'SUSPENDED'
}

export enum AttendanceStatusEnum {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  EXCUSED = 'EXCUSED'
}

export enum SessionTypeEnum {
  MORNING = 'MORNING',
  EVENING = 'EVENING',
  FULL_DAY = 'FULL_DAY'
}

export enum SessionStatusEnum {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED'
}

export enum PaymentMethodEnum {
  CASH = 'CASH',
  UPI = 'UPI',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CHEQUE = 'CHEQUE'
}

export enum PaymentStatusEnum {
  COMPLETED = 'COMPLETED',
  REVERSED = 'REVERSED',
  PENDING = 'PENDING'
}

export enum InvoiceStatusEnum {
  UNPAID = 'UNPAID',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED'
}

export enum QuestionTypeEnum {
  MCQ = 'MCQ',
  TRUE_FALSE = 'TRUE_FALSE',
  SHORT_ANSWER = 'SHORT_ANSWER',
  LONG_ANSWER = 'LONG_ANSWER',
  NUMERICAL = 'NUMERICAL'
}

export enum DifficultyLevelEnum {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export enum ExaminationStatusEnum {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  EVALUATION = 'EVALUATION',
  PUBLISHED = 'PUBLISHED'
}

export enum SubmissionStatusEnum {
  UPLOADED = 'UPLOADED',
  OCR_PROCESSING = 'OCR_PROCESSING',
  AI_EVALUATED = 'AI_EVALUATED',
  TEACHER_REVIEWED = 'TEACHER_REVIEWED',
  PUBLISHED = 'PUBLISHED',
  FLAGGED = 'FLAGGED'
}

export enum AIEvaluationStatusEnum {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  FLAGGED = 'FLAGGED'
}

export enum ReviewCategoryEnum {
  AUTO_PASS_READY_FOR_REVIEW = 'AUTO_PASS_READY_FOR_REVIEW',
  FLAGGED_LOW_CONFIDENCE = 'FLAGGED_LOW_CONFIDENCE',
  FLAGGED_OCR_ERROR = 'FLAGGED_OCR_ERROR',
  MANUAL_REVIEW_REQUIRED = 'MANUAL_REVIEW_REQUIRED'
}

export enum CourseCategoryEnum {
  ACADEMIC = 'ACADEMIC',
  SKILL = 'SKILL'
}

export enum StaffCategoryEnum {
  GENERAL = 'GENERAL',
  FACULTY = 'FACULTY'
}

export enum CompensationModelEnum {
  FIXED_SALARY = 'FIXED_SALARY',
  REVENUE_SHARING = 'REVENUE_SHARING'
}

export enum PayFrequencyEnum {
  MONTHLY = 'MONTHLY',
  BI_WEEKLY = 'BI_WEEKLY',
  WEEKLY = 'WEEKLY'
}

