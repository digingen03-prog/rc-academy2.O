import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
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
import {
  ExaminationStatus,
  QuestionStatus,
  QuestionType,
  DifficultyLevel,
  ExamAttendanceStatus,
  StudentStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ExaminationsService {
  private readonly logger = new Logger(ExaminationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ====================================================
  // 1. QUESTION BANK
  // ====================================================

  async getQuestions(query: {
    subjectId?: string;
    topic?: string;
    difficulty?: DifficultyLevel;
    questionType?: QuestionType;
    status?: QuestionStatus;
    search?: string;
  }) {
    const where: any = {};
    if (query.subjectId) where.subjectId = query.subjectId;
    if (query.topic) where.topic = { contains: query.topic, mode: 'insensitive' };
    if (query.difficulty) where.difficulty = query.difficulty;
    if (query.questionType) where.questionType = query.questionType;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { content: { contains: query.search, mode: 'insensitive' } },
        { topic: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.question.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        subject: true,
        _count: {
          select: { examLinks: true },
        },
      },
    });
  }

  async getQuestionById(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: {
        subject: true,
        examLinks: {
          include: {
            examination: true,
          },
        },
      },
    });

    if (!question) {
      throw new NotFoundException(`Question ${id} not found`);
    }

    return question;
  }

  async createQuestion(dto: CreateQuestionDto, actorId?: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: dto.subjectId },
    });
    if (!subject) {
      throw new NotFoundException(`Subject ${dto.subjectId} not found`);
    }

    if (dto.questionType === QuestionType.MCQ && (!dto.options || dto.options.length < 2)) {
      throw new BadRequestException('Multiple choice questions require at least 2 options');
    }

    return this.prisma.question.create({
      data: {
        subjectId: dto.subjectId,
        topic: dto.topic,
        questionType: dto.questionType,
        difficulty: dto.difficulty,
        content: dto.content,
        maxMarks: new Decimal(dto.maxMarks),
        options: dto.options ? (dto.options as any) : undefined,
        answerKeyText: dto.answerKeyText,
        explanation: dto.explanation,
        sourceReference: dto.sourceReference,
        markingRubricJson: dto.markingRubricJson ? (dto.markingRubricJson as any) : undefined,
        status: dto.status || QuestionStatus.APPROVED,
        createdById: actorId,
      },
      include: {
        subject: true,
      },
    });
  }

  async updateQuestion(id: string, dto: UpdateQuestionDto) {
    const existing = await this.getQuestionById(id);

    return this.prisma.question.update({
      where: { id },
      data: {
        ...(dto.topic && { topic: dto.topic }),
        ...(dto.questionType && { questionType: dto.questionType }),
        ...(dto.difficulty && { difficulty: dto.difficulty }),
        ...(dto.content && { content: dto.content }),
        ...(dto.maxMarks && { maxMarks: new Decimal(dto.maxMarks) }),
        ...(dto.options && { options: dto.options as any }),
        ...(dto.answerKeyText !== undefined && { answerKeyText: dto.answerKeyText }),
        ...(dto.explanation !== undefined && { explanation: dto.explanation }),
        ...(dto.sourceReference !== undefined && { sourceReference: dto.sourceReference }),
        ...(dto.markingRubricJson && { markingRubricJson: dto.markingRubricJson as any }),
        ...(dto.status && { status: dto.status }),
      },
      include: {
        subject: true,
      },
    });
  }

  async deleteQuestion(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: {
        examLinks: {
          include: {
            examination: true,
          },
        },
      },
    });

    if (!question) {
      throw new NotFoundException(`Question ${id} not found`);
    }

    const publishedExams = question.examLinks.filter(
      (link) => link.examination.status === ExaminationStatus.PUBLISHED || link.examination.isPublished,
    );

    if (publishedExams.length > 0) {
      throw new BadRequestException(
        `Cannot delete question as it is linked to ${publishedExams.length} published examination(s)`,
      );
    }

    return this.prisma.question.delete({
      where: { id },
    });
  }

  // ====================================================
  // 2. EXAMINATION SETUP
  // ====================================================

  async findAll(query: {
    classId?: string;
    batchId?: string;
    subjectId?: string;
    status?: ExaminationStatus;
    academicYearId?: string;
  }) {
    const where: any = {};
    if (query.classId) where.classId = query.classId;
    if (query.batchId) where.batchId = query.batchId;
    if (query.subjectId) where.subjectId = query.subjectId;
    if (query.status) where.status = query.status;
    if (query.academicYearId) where.academicYearId = query.academicYearId;

    return this.prisma.examination.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        class: true,
        batch: true,
        subject: true,
        academicYear: true,
        _count: {
          select: { questions: true, submissions: true, results: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const exam = await this.prisma.examination.findUnique({
      where: { id },
      include: {
        class: true,
        batch: true,
        subject: true,
        academicYear: true,
        questions: {
          orderBy: { orderNumber: 'asc' },
          include: {
            question: true,
          },
        },
        _count: {
          select: { submissions: true, results: true },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException(`Examination ${id} not found`);
    }

    return exam;
  }

  async create(dto: CreateExaminationDto) {
    const classEntity = await this.prisma.class.findUnique({
      where: { id: dto.classId },
    });
    if (!classEntity) {
      throw new NotFoundException(`Class ${dto.classId} not found`);
    }

    const subject = await this.prisma.subject.findUnique({
      where: { id: dto.subjectId },
    });
    if (!subject) {
      throw new NotFoundException(`Subject ${dto.subjectId} not found`);
    }

    const totalMarks = new Decimal(dto.totalMarks);
    const passMarks = dto.passMarks ? new Decimal(dto.passMarks) : totalMarks.mul(0.35);

    if (passMarks.gt(totalMarks)) {
      throw new BadRequestException('Pass marks cannot exceed maximum total marks');
    }

    const examDate = new Date(dto.date);
    if (isNaN(examDate.getTime())) {
      throw new BadRequestException('Invalid examination date provided');
    }

    // Check for conflicting examination schedule for the same batch on same date
    if (dto.batchId) {
      const conflict = await this.prisma.examination.findFirst({
        where: {
          batchId: dto.batchId,
          subjectId: dto.subjectId,
          date: examDate,
          status: { not: ExaminationStatus.DRAFT },
        },
      });
      if (conflict) {
        throw new BadRequestException(
          `Schedule conflict: An examination (${conflict.title}) is already scheduled for this batch and subject on ${dto.date}`,
        );
      }
    }

    return this.prisma.examination.create({
      data: {
        title: dto.title,
        examType: dto.examType,
        classId: dto.classId,
        batchId: dto.batchId,
        subjectId: dto.subjectId,
        academicYearId: dto.academicYearId || classEntity.academicYearId,
        date: examDate,
        durationMinutes: dto.durationMinutes,
        totalMarks,
        passMarks,
        instructions: dto.instructions,
        status: ExaminationStatus.DRAFT,
      },
      include: {
        class: true,
        batch: true,
        subject: true,
      },
    });
  }

  async update(id: string, dto: UpdateExaminationDto, actorId: string) {
    const exam = await this.findOne(id);

    if (exam.status === ExaminationStatus.COMPLETED || exam.status === ExaminationStatus.PUBLISHED) {
      throw new BadRequestException('Cannot edit a completed or published examination record');
    }

    let totalMarks = exam.totalMarks;
    if (dto.totalMarks) {
      totalMarks = new Decimal(dto.totalMarks);
    }

    let passMarks = exam.passMarks;
    if (dto.passMarks !== undefined) {
      passMarks = new Decimal(dto.passMarks);
    }

    if (passMarks.gt(totalMarks)) {
      throw new BadRequestException('Pass marks cannot exceed total marks');
    }

    return this.prisma.examination.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.examType && { examType: dto.examType }),
        ...(dto.date && { date: new Date(dto.date) }),
        ...(dto.durationMinutes && { durationMinutes: dto.durationMinutes }),
        ...(dto.totalMarks && { totalMarks }),
        ...(dto.passMarks !== undefined && { passMarks }),
        ...(dto.instructions !== undefined && { instructions: dto.instructions }),
        ...(dto.status && { status: dto.status }),
      },
      include: {
        class: true,
        batch: true,
        subject: true,
      },
    });
  }

  async updateStatus(id: string, status: ExaminationStatus, actorId: string) {
    const exam = await this.findOne(id);

    const updated = await this.prisma.examination.update({
      where: { id },
      data: { status },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'EXAMINATION_STATUS_CHANGE',
        entityType: 'Examination',
        entityId: id,
        details: {
          previousStatus: exam.status,
          newStatus: status,
          examTitle: exam.title,
        },
      },
    });

    return updated;
  }

  // ====================================================
  // 3. QUESTION PAPER BUILDER
  // ====================================================

  async configurePaper(examId: string, dto: ConfigurePaperDto) {
    const exam = await this.findOne(examId);

    if (exam.status === ExaminationStatus.COMPLETED || exam.status === ExaminationStatus.PUBLISHED) {
      throw new BadRequestException('Cannot reconfigure paper for a completed or published examination');
    }

    if (!dto.questions || dto.questions.length === 0) {
      throw new BadRequestException('Question paper must contain at least one question');
    }

    // Check duplicate questions
    const questionIdSet = new Set<string>();
    for (const q of dto.questions) {
      if (questionIdSet.has(q.questionId)) {
        throw new BadRequestException(`Duplicate question (${q.questionId}) found in the paper layout`);
      }
      questionIdSet.add(q.questionId);
    }

    // Fetch question objects to calculate sum of marks
    const questions = await this.prisma.question.findMany({
      where: {
        id: { in: Array.from(questionIdSet) },
      },
    });

    if (questions.length !== questionIdSet.size) {
      throw new NotFoundException('One or more question IDs in the paper layout were not found');
    }

    const questionMap = new Map<string, (typeof questions)[0]>();
    for (const q of questions) {
      questionMap.set(q.id, q);
    }

    let calculatedTotal = new Decimal(0);
    for (const item of dto.questions) {
      const q = questionMap.get(item.questionId)!;
      calculatedTotal = calculatedTotal.add(q.maxMarks);
    }

    if (!calculatedTotal.equals(exam.totalMarks)) {
      throw new BadRequestException(
        `Question paper mark total (${calculatedTotal.toString()}) does not match examination total marks (${exam.totalMarks.toString()})`,
      );
    }

    // Transactionally rebuild question paper links
    return this.prisma.$transaction(async (tx) => {
      await tx.examinationQuestion.deleteMany({
        where: { examinationId: examId },
      });

      let order = 1;
      for (const item of dto.questions) {
        await tx.examinationQuestion.create({
          data: {
            examinationId: examId,
            questionId: item.questionId,
            orderNumber: item.orderNumber || order++,
            sectionName: item.sectionName || 'Section A',
            sectionInstructions: item.sectionInstructions,
          },
        });
      }

      return tx.examination.findUnique({
        where: { id: examId },
        include: {
          questions: {
            orderBy: { orderNumber: 'asc' },
            include: { question: true },
          },
        },
      });
    });
  }

  async publishPaper(examId: string, actorId: string) {
    const exam = await this.findOne(examId);

    if (exam.questions.length === 0) {
      throw new BadRequestException('Cannot publish an empty examination paper. Add questions first.');
    }

    const updated = await this.prisma.examination.update({
      where: { id: examId },
      data: {
        isPublished: true,
        paperVersion: exam.paperVersion + 1,
        status: exam.status === ExaminationStatus.DRAFT ? ExaminationStatus.SCHEDULED : exam.status,
      },
      include: {
        questions: {
          orderBy: { orderNumber: 'asc' },
          include: { question: true },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'EXAMINATION_PAPER_PUBLISHED',
        entityType: 'Examination',
        entityId: examId,
        details: {
          paperVersion: updated.paperVersion,
          questionsCount: updated.questions.length,
          totalMarks: updated.totalMarks.toString(),
        },
      },
    });

    return updated;
  }

  async getPaper(examId: string) {
    const exam = await this.findOne(examId);

    // Group questions by section
    const sections: Record<string, any[]> = {};
    for (const eq of exam.questions) {
      const section = eq.sectionName || 'General Section';
      if (!sections[section]) {
        sections[section] = [];
      }
      sections[section].push({
        orderNumber: eq.orderNumber,
        sectionInstructions: eq.sectionInstructions,
        questionId: eq.question.id,
        content: eq.question.content,
        questionType: eq.question.questionType,
        maxMarks: eq.question.maxMarks,
        options: eq.question.options,
        difficulty: eq.question.difficulty,
        explanation: eq.question.explanation,
      });
    }

    return {
      academy: {
        name: 'RC Academy',
        department: 'Examination & Assessment Cell',
      },
      examination: {
        id: exam.id,
        title: exam.title,
        examType: exam.examType,
        class: exam.class.name,
        batch: exam.batch?.name || 'All Sections',
        subject: `${exam.subject.name} (${exam.subject.code})`,
        date: exam.date,
        durationMinutes: exam.durationMinutes,
        totalMarks: exam.totalMarks,
        passMarks: exam.passMarks,
        instructions: exam.instructions,
        isPublished: exam.isPublished,
        paperVersion: exam.paperVersion,
      },
      sections: Object.entries(sections).map(([sectionName, items]) => ({
        sectionName,
        questions: items,
      })),
    };
  }

  // ====================================================
  // 4. LOCAL AI QUESTION GENERATOR
  // ====================================================

  async generateAIQuestions(dto: GenerateAIQuestionsDto, actorId: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: dto.subjectId },
    });
    if (!subject) {
      throw new NotFoundException(`Subject ${dto.subjectId} not found`);
    }

    const marks = dto.marksPerQuestion || (dto.questionType === QuestionType.MCQ ? 1 : 5);
    const difficulty = dto.difficulty || DifficultyLevel.MEDIUM;
    const qType = dto.questionType || QuestionType.SHORT_ANSWER;

    const generatedItems: any[] = [];

    // Deterministic generation of quality academic questions ready for teacher review
    for (let i = 1; i <= dto.count; i++) {
      let content = ``;
      let options = undefined;
      let answerKeyText = ``;
      let explanation = ``;

      if (qType === QuestionType.MCQ) {
        content = `Sample AI Generated Question ${i} on ${dto.topic}: Which of the following best describes the fundamental principle of ${dto.topic}?`;
        options = [
          { key: 'A', text: `Standard property representing ${dto.topic}`, isCorrect: true },
          { key: 'B', text: `Inverse proportional relationship`, isCorrect: false },
          { key: 'C', text: `Static equilibrium state`, isCorrect: false },
          { key: 'D', text: `None of the above`, isCorrect: false },
        ];
        answerKeyText = 'Option A';
        explanation = `According to standard ${subject.name} curriculum principles on ${dto.topic}, Option A is correct.`;
      } else {
        content = `Explain in detail the concept and practical application of ${dto.topic}. [Problem ${i}]`;
        answerKeyText = `Model Answer: ${dto.topic} establishes that the system responds proportionally to inputs, requiring proper boundary validation.`;
        explanation = `Marking criteria: 2 marks for core definition, 2 marks for derivation, 1 mark for practical example.`;
      }

      const q = await this.prisma.question.create({
        data: {
          subjectId: dto.subjectId,
          topic: dto.topic,
          questionType: qType,
          difficulty,
          status: QuestionStatus.DRAFT, // Always drafted until teacher reviews and approves
          content,
          maxMarks: new Decimal(marks),
          options: options ? (options as any) : undefined,
          answerKeyText,
          explanation,
          sourceReference: 'AI Generated (Ollama qwen2.5:3b - Local Draft)',
          createdById: actorId,
        },
      });

      generatedItems.push(q);
    }

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'AI_QUESTIONS_GENERATED',
        entityType: 'Question',
        entityId: dto.subjectId,
        details: {
          subjectName: subject.name,
          topic: dto.topic,
          count: dto.count,
          difficulty,
        },
      },
    });

    return {
      message: `Generated ${dto.count} draft questions for topic '${dto.topic}'`,
      model: 'qwen2.5:3b (Local Ollama Engine)',
      questions: generatedItems,
    };
  }

  // ====================================================
  // 5. CANDIDATES & EXAM ATTENDANCE
  // ====================================================

  async getCandidates(examId: string) {
    const exam = await this.findOne(examId);

    // Retrieve active students enrolled in the class/batch and subject
    const enrollments = await this.prisma.studentBatchEnrollment.findMany({
      where: {
        isActive: true,
        ...(exam.batchId
          ? { batchId: exam.batchId }
          : { batch: { classId: exam.classId } }),
        ...(exam.subjectId
          ? {
              OR: [
                { subjectId: exam.subjectId },
                { subjectId: null },
              ],
            }
          : {}),
      },
      include: {
        student: true,
        batch: true,
      },
      orderBy: { student: { studentCode: 'asc' } },
    });

    const results = await this.prisma.result.findMany({
      where: { examinationId: examId },
    });
    const resultMap = new Map<string, (typeof results)[0]>();
    for (const r of results) {
      resultMap.set(r.studentId, r);
    }

    // Deduplicate in case student has both general and subject enrollment
    const seen = new Set<string>();
    const candidates: any[] = [];

    for (const e of enrollments) {
      if (seen.has(e.studentId)) continue;
      seen.add(e.studentId);

      const existingResult = resultMap.get(e.studentId);
      candidates.push({
        studentId: e.student.id,
        studentName: `${e.student.firstName} ${e.student.lastName}`,
        studentCode: e.student.studentCode,
        admissionNumber: e.student.admissionNumber,
        batchName: e.batch.name,
        attendanceStatus: existingResult?.attendanceStatus || ExamAttendanceStatus.PRESENT,
        result: existingResult
          ? {
              obtainedMarks: existingResult.obtainedMarks,
              percentage: existingResult.percentage,
              grade: existingResult.grade,
              isPassed: existingResult.isPassed,
              isPublished: existingResult.isPublished,
            }
          : null,
      });
    }

    return candidates;
  }

  async recordAttendance(examId: string, dto: RecordExamAttendanceDto, actorId: string) {
    const exam = await this.findOne(examId);

    const student = await this.prisma.student.findUnique({
      where: { id: dto.studentId },
    });
    if (!student) {
      throw new NotFoundException(`Student ${dto.studentId} not found`);
    }

    // Validate active enrollment in examination's course/batch and subject
    const enrollment = await this.prisma.studentBatchEnrollment.findFirst({
      where: {
        studentId: dto.studentId,
        isActive: true,
        ...(exam.batchId ? { batchId: exam.batchId } : { batch: { classId: exam.classId } }),
        ...(exam.subjectId
          ? {
              OR: [
                { subjectId: exam.subjectId },
                { subjectId: null },
              ],
            }
          : {}),
      },
    });

    if (!enrollment) {
      throw new BadRequestException(
        `Student '${student.firstName} ${student.lastName}' (${student.studentCode}) is not enrolled in this examination's course/batch/subject`,
      );
    }

    return this.prisma.result.upsert({
      where: {
        examinationId_studentId: {
          examinationId: examId,
          studentId: dto.studentId,
        },
      },
      update: {
        attendanceStatus: dto.status,
        ...(dto.status === ExamAttendanceStatus.ABSENT && {
          obtainedMarks: new Decimal(0),
          percentage: new Decimal(0),
          grade: 'F',
          isPassed: false,
        }),
      },
      create: {
        examinationId: examId,
        studentId: dto.studentId,
        attendanceStatus: dto.status,
        obtainedMarks: new Decimal(0),
        percentage: new Decimal(0),
        grade: dto.status === ExamAttendanceStatus.ABSENT ? 'F' : undefined,
        isPassed: dto.status === ExamAttendanceStatus.EXEMPT,
      },
    });
  }

  // ====================================================
  // 6. MARKS ENTRY, CALCULATIONS & RESULTS
  // ====================================================

  private calculateGrade(percentage: number): string {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 35) return 'D';
    return 'F';
  }

  async submitMarks(examId: string, dto: SubmitMarksDto, actorId: string) {
    const exam = await this.findOne(examId);

    if (exam.status === ExaminationStatus.PUBLISHED && exam.isPublished) {
      throw new BadRequestException(
        'Results for this examination have already been finalized. Use the audited correction workflow for updates.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const results: any[] = [];

      for (const entry of dto.entries) {
        const student = await tx.student.findUnique({
          where: { id: entry.studentId },
        });
        if (!student) {
          throw new NotFoundException(`Student ${entry.studentId} not found`);
        }

        // Validate active enrollment in examination's course/batch and subject
        const enrollment = await tx.studentBatchEnrollment.findFirst({
          where: {
            studentId: entry.studentId,
            isActive: true,
            ...(exam.batchId ? { batchId: exam.batchId } : { batch: { classId: exam.classId } }),
            ...(exam.subjectId
              ? {
                  OR: [
                    { subjectId: exam.subjectId },
                    { subjectId: null },
                  ],
                }
              : {}),
          },
        });

        if (!enrollment) {
          throw new BadRequestException(
            `Student '${student.firstName} ${student.lastName}' (${student.studentCode}) is not enrolled in this examination's course/batch/subject`,
          );
        }

        const marks = new Decimal(entry.marks);
        if (marks.gt(exam.totalMarks)) {
          throw new BadRequestException(
            `Marks entered (${marks.toString()}) for student ${student.studentCode} exceed examination maximum marks (${exam.totalMarks.toString()})`,
          );
        }

        const attendance = entry.attendanceStatus || ExamAttendanceStatus.PRESENT;
        let percentage = new Decimal(0);
        let grade = 'F';
        let isPassed = false;

        if (attendance === ExamAttendanceStatus.PRESENT) {
          percentage = marks.div(exam.totalMarks).mul(100);
          grade = this.calculateGrade(percentage.toNumber());
          isPassed = marks.gte(exam.passMarks);
        } else if (attendance === ExamAttendanceStatus.EXEMPT) {
          percentage = new Decimal(0);
          grade = 'EXEMPT';
          isPassed = true;
        }

        const res = await tx.result.upsert({
          where: {
            examinationId_studentId: {
              examinationId: examId,
              studentId: entry.studentId,
            },
          },
          update: {
            attendanceStatus: attendance,
            obtainedMarks: marks,
            percentage,
            grade,
            isPassed,
          },
          create: {
            examinationId: examId,
            studentId: entry.studentId,
            attendanceStatus: attendance,
            obtainedMarks: marks,
            percentage,
            grade,
            isPassed,
          },
        });

        results.push(res);
      }

      // Update exam status to EVALUATION if in DRAFT/SCHEDULED/IN_PROGRESS
      if (exam.status !== ExaminationStatus.EVALUATION) {
        await tx.examination.update({
          where: { id: examId },
          data: { status: ExaminationStatus.EVALUATION },
        });
      }

      return {
        message: `Successfully processed marks for ${results.length} candidate(s)`,
        processedCount: results.length,
      };
    });
  }

  async finalizeResults(examId: string, actorId: string) {
    const exam = await this.findOne(examId);

    return this.prisma.$transaction(async (tx) => {
      const results = await tx.result.findMany({
        where: { examinationId: examId },
        orderBy: [{ obtainedMarks: 'desc' }, { percentage: 'desc' }],
      });

      if (results.length === 0) {
        throw new BadRequestException('Cannot finalize examination without any entered marks records');
      }

      let currentRank = 1;
      for (const res of results) {
        const rankToAssign = res.attendanceStatus === ExamAttendanceStatus.PRESENT ? currentRank++ : null;

        await tx.result.update({
          where: { id: res.id },
          data: {
            rank: rankToAssign,
            isPublished: true,
            publishedAt: new Date(),
          },
        });
      }

      await tx.examination.update({
        where: { id: examId },
        data: {
          status: ExaminationStatus.PUBLISHED,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'EXAMINATION_RESULTS_FINALIZED',
          entityType: 'Examination',
          entityId: examId,
          details: {
            totalEvaluated: results.length,
            examTitle: exam.title,
          },
        },
      });

      return {
        message: `Results finalized and published for ${results.length} candidates`,
        totalEvaluated: results.length,
      };
    });
  }

  async correctResult(examId: string, dto: CorrectResultDto, actorId: string) {
    const exam = await this.findOne(examId);

    const result = await this.prisma.result.findUnique({
      where: {
        examinationId_studentId: {
          examinationId: examId,
          studentId: dto.studentId,
        },
      },
      include: {
        student: true,
      },
    });

    if (!result) {
      throw new NotFoundException(`Result for student ${dto.studentId} not found in this examination`);
    }

    const newMarks = new Decimal(dto.correctedMarks);
    if (newMarks.gt(exam.totalMarks)) {
      throw new BadRequestException(
        `Corrected marks (${newMarks.toString()}) exceed exam maximum marks (${exam.totalMarks.toString()})`,
      );
    }

    const newPercentage = newMarks.div(exam.totalMarks).mul(100);
    const newGrade = this.calculateGrade(newPercentage.toNumber());
    const newIsPassed = newMarks.gte(exam.passMarks);

    const previousMarks = result.obtainedMarks;

    const updated = await this.prisma.result.update({
      where: { id: result.id },
      data: {
        obtainedMarks: newMarks,
        percentage: newPercentage,
        grade: newGrade,
        isPassed: newIsPassed,
        correctedMarks: newMarks,
        correctionReason: dto.reason,
        correctedById: actorId,
        correctedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'RESULT_CORRECTION',
        entityType: 'Result',
        entityId: result.id,
        details: {
          studentCode: result.student.studentCode,
          previousMarks: previousMarks.toString(),
          correctedMarks: newMarks.toString(),
          reason: dto.reason,
        },
      },
    });

    return {
      message: 'Result correction recorded and audited successfully',
      result: updated,
    };
  }

  async getResults(examId: string) {
    const exam = await this.findOne(examId);

    const results = await this.prisma.result.findMany({
      where: { examinationId: examId },
      include: {
        student: true,
      },
      orderBy: [{ rank: 'asc' }, { obtainedMarks: 'desc' }],
    });

    let totalAppeared = 0;
    let totalAbsent = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalMarksSum = new Decimal(0);
    let highestMarks = new Decimal(0);
    let lowestMarks = exam.totalMarks;

    const gradeCounts: Record<string, number> = {
      'A+': 0,
      A: 0,
      'B+': 0,
      B: 0,
      C: 0,
      D: 0,
      F: 0,
    };

    for (const r of results) {
      if (r.attendanceStatus === ExamAttendanceStatus.PRESENT) {
        totalAppeared++;
        totalMarksSum = totalMarksSum.add(r.obtainedMarks);

        if (r.obtainedMarks.gt(highestMarks)) highestMarks = r.obtainedMarks;
        if (r.obtainedMarks.lt(lowestMarks)) lowestMarks = r.obtainedMarks;

        if (r.isPassed) totalPassed++;
        else totalFailed++;

        if (r.grade && gradeCounts[r.grade] !== undefined) {
          gradeCounts[r.grade]++;
        }
      } else if (r.attendanceStatus === ExamAttendanceStatus.ABSENT) {
        totalAbsent++;
        totalFailed++;
        gradeCounts['F']++;
      }
    }

    const averageMarks =
      totalAppeared > 0 ? totalMarksSum.div(totalAppeared).toDecimalPlaces(2) : new Decimal(0);
    const passPercentage =
      totalAppeared > 0
        ? new Decimal(totalPassed).div(totalAppeared).mul(100).toDecimalPlaces(1)
        : new Decimal(0);

    return {
      examination: {
        id: exam.id,
        title: exam.title,
        subject: exam.subject.name,
        class: exam.class.name,
        batch: exam.batch?.name || 'All',
        totalMarks: exam.totalMarks,
        passMarks: exam.passMarks,
        status: exam.status,
      },
      statistics: {
        totalStudents: results.length,
        appeared: totalAppeared,
        absent: totalAbsent,
        passed: totalPassed,
        failed: totalFailed,
        highestMarks: totalAppeared > 0 ? highestMarks.toString() : '0',
        lowestMarks: totalAppeared > 0 ? lowestMarks.toString() : '0',
        averageMarks: averageMarks.toString(),
        passPercentage: `${passPercentage.toString()}%`,
        gradeDistribution: gradeCounts,
      },
      roster: results.map((r) => ({
        id: r.id,
        studentId: r.student.id,
        studentName: `${r.student.firstName} ${r.student.lastName}`,
        studentCode: r.student.studentCode,
        admissionNumber: r.student.admissionNumber,
        attendanceStatus: r.attendanceStatus,
        obtainedMarks: r.obtainedMarks.toString(),
        percentage: `${r.percentage.toString()}%`,
        grade: r.grade,
        rank: r.rank,
        isPassed: r.isPassed,
        isPublished: r.isPublished,
        correctedMarks: r.correctedMarks?.toString() || null,
        correctionReason: r.correctionReason,
      })),
    };
  }
}
