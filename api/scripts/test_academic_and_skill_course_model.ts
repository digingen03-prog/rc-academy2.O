import { PrismaClient, CourseCategory, SessionStatus, ExamAttendanceStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function runTests() {
  console.log('\n=============================================================');
  console.log(' RCA2.O - UNIFIED ACADEMIC & SKILL COURSES INTEGRATION TEST ');
  console.log('=============================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      if (detail) console.log(`         -> ${detail}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      if (detail) console.error(`         -> ${detail}`);
    }
  }

  try {
    // 0. Ensure Academic Year
    let academicYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
    if (!academicYear) {
      academicYear = await prisma.academicYear.create({
        data: {
          name: '2026-2027',
          startDate: new Date('2026-06-01'),
          endDate: new Date('2027-05-31'),
          isCurrent: true,
        },
      });
    }

    // 1. Setup Academic Standards & Skill Courses
    console.log('1. Setting up Academic Standards and Skill Courses...');

    // 10th Standard (Academic)
    let std10 = await prisma.class.findFirst({ where: { code: 'TEST-STD10' } });
    if (!std10) {
      std10 = await prisma.class.create({
        data: {
          name: 'Test 10th Standard',
          code: 'TEST-STD10',
          category: CourseCategory.ACADEMIC,
          academicYearId: academicYear.id,
        },
      });
    }

    let batch10A = await prisma.batch.findFirst({ where: { classId: std10.id, name: 'Section A' } });
    if (!batch10A) {
      batch10A = await prisma.batch.create({
        data: { name: 'Section A', code: 'T10-A', classId: std10.id },
      });
    }

    let sub10Maths = await prisma.subject.findFirst({ where: { classId: std10.id, code: 'T10MTH' } });
    if (!sub10Maths) {
      sub10Maths = await prisma.subject.create({
        data: { name: 'Mathematics', code: 'T10MTH', classId: std10.id },
      });
    }

    let sub10English = await prisma.subject.findFirst({ where: { classId: std10.id, code: 'T10ENG' } });
    if (!sub10English) {
      sub10English = await prisma.subject.create({
        data: { name: 'English Language', code: 'T10ENG', classId: std10.id },
      });
    }

    // 12th Standard (Academic)
    let std12 = await prisma.class.findFirst({ where: { code: 'TEST-STD12' } });
    if (!std12) {
      std12 = await prisma.class.create({
        data: {
          name: 'Test 12th Standard',
          code: 'TEST-STD12',
          category: CourseCategory.ACADEMIC,
          academicYearId: academicYear.id,
        },
      });
    }

    let batch12A = await prisma.batch.findFirst({ where: { classId: std12.id, name: 'Section A' } });
    if (!batch12A) {
      batch12A = await prisma.batch.create({
        data: { name: 'Section A', code: 'T12-A', classId: std12.id },
      });
    }

    let sub12Physics = await prisma.subject.findFirst({ where: { classId: std12.id, code: 'T12PHY' } });
    if (!sub12Physics) {
      sub12Physics = await prisma.subject.create({
        data: { name: 'Physics', code: 'T12PHY', classId: std12.id },
      });
    }

    let sub12Maths = await prisma.subject.findFirst({ where: { classId: std12.id, code: 'T12MTH' } });
    if (!sub12Maths) {
      sub12Maths = await prisma.subject.create({
        data: { name: 'Mathematics', code: 'T12MTH', classId: std12.id },
      });
    }

    // Drawing (Skill Course)
    let sklDrawing = await prisma.class.findFirst({ where: { code: 'TEST-DRAW' } });
    if (!sklDrawing) {
      sklDrawing = await prisma.class.create({
        data: {
          name: 'Drawing & Fine Arts',
          code: 'TEST-DRAW',
          category: CourseCategory.SKILL,
          academicYearId: academicYear.id,
        },
      });
    }

    let batchDrawWeekend = await prisma.batch.findFirst({ where: { classId: sklDrawing.id, name: 'Weekend Batch' } });
    if (!batchDrawWeekend) {
      batchDrawWeekend = await prisma.batch.create({
        data: { name: 'Weekend Batch', code: 'DRW-WKND', classId: sklDrawing.id },
      });
    }

    // Spoken English (Skill Course)
    let sklSpokenEng = await prisma.class.findFirst({ where: { code: 'TEST-SPKENG' } });
    if (!sklSpokenEng) {
      sklSpokenEng = await prisma.class.create({
        data: {
          name: 'Spoken English & Communication',
          code: 'TEST-SPKENG',
          category: CourseCategory.SKILL,
          academicYearId: academicYear.id,
        },
      });
    }

    let batchSpokenEvening = await prisma.batch.findFirst({ where: { classId: sklSpokenEng.id, name: 'Evening Cohort' } });
    if (!batchSpokenEvening) {
      batchSpokenEvening = await prisma.batch.create({
        data: { name: 'Evening Cohort', code: 'SPK-EVE', classId: sklSpokenEng.id },
      });
    }

    assert(std10.category === CourseCategory.ACADEMIC, 'Standard 10th categorized as ACADEMIC');
    assert(sklDrawing.category === CourseCategory.SKILL, 'Drawing categorized as SKILL');

    // 2. Scenario A: Student 1 - Enrolled in 10th Maths only
    console.log('\n2. Testing Scenario A: Student enrolled in 10th Maths only...');
    const s1Code = `T-S1-${Date.now().toString().slice(-4)}`;
    const student1 = await prisma.student.create({
      data: {
        firstName: 'Dev',
        lastName: 'Mathur',
        studentCode: s1Code,
        admissionNumber: `ADM-${s1Code}`,
        attendanceCode: `${Math.floor(100 + Math.random() * 899)}`,
        dob: new Date('2010-04-12'),
        gender: 'MALE',
      },
    });

    const en1 = await prisma.studentBatchEnrollment.create({
      data: {
        studentId: student1.id,
        batchId: batch10A.id,
        subjectId: sub10Maths.id,
        isActive: true,
      },
    });

    assert(en1.subjectId === sub10Maths.id, 'Student 1 enrolled in 10th Maths subject specifically');

    // 3. Scenario B: Student 2 - Enrolled in 10th Maths + 10th English (Same Batch, Multiple Subjects)
    console.log('\n3. Testing Scenario B: Student enrolled in 10th Maths AND 10th English...');
    const s2Code = `T-S2-${Date.now().toString().slice(-4)}`;
    const student2 = await prisma.student.create({
      data: {
        firstName: 'Ananya',
        lastName: 'Iyer',
        studentCode: s2Code,
        admissionNumber: `ADM-${s2Code}`,
        attendanceCode: `${Math.floor(100 + Math.random() * 899)}`,
        dob: new Date('2010-06-20'),
        gender: 'FEMALE',
      },
    });

    const en2_maths = await prisma.studentBatchEnrollment.create({
      data: {
        studentId: student2.id,
        batchId: batch10A.id,
        subjectId: sub10Maths.id,
        isActive: true,
      },
    });

    const en2_english = await prisma.studentBatchEnrollment.create({
      data: {
        studentId: student2.id,
        batchId: batch10A.id,
        subjectId: sub10English.id,
        isActive: true,
      },
    });

    const s2ActiveEnrollments = await prisma.studentBatchEnrollment.findMany({
      where: { studentId: student2.id, isActive: true },
    });

    assert(s2ActiveEnrollments.length === 2, 'Student 2 has 2 active enrollments in the same batch');
    assert(
      s2ActiveEnrollments.some((e) => e.subjectId === sub10Maths.id) &&
      s2ActiveEnrollments.some((e) => e.subjectId === sub10English.id),
      'Student 2 holds distinct subject enrollments for Maths and English',
    );

    // 4. Scenario C: Student 3 - Enrolled in 12th Physics and 12th Maths
    console.log('\n4. Testing Scenario C: Student enrolled in 12th Physics and 12th Maths...');
    const s3Code = `T-S3-${Date.now().toString().slice(-4)}`;
    const student3 = await prisma.student.create({
      data: {
        firstName: 'Rohan',
        lastName: 'Verma',
        studentCode: s3Code,
        admissionNumber: `ADM-${s3Code}`,
        attendanceCode: `${Math.floor(100 + Math.random() * 899)}`,
        dob: new Date('2008-09-15'),
        gender: 'MALE',
      },
    });

    await prisma.studentBatchEnrollment.createMany({
      data: [
        { studentId: student3.id, batchId: batch12A.id, subjectId: sub12Physics.id, isActive: true },
        { studentId: student3.id, batchId: batch12A.id, subjectId: sub12Maths.id, isActive: true },
      ],
    });

    const s3Enrollments = await prisma.studentBatchEnrollment.findMany({
      where: { studentId: student3.id, isActive: true },
    });
    assert(s3Enrollments.length === 2, 'Student 3 successfully enrolled in 12th Physics + 12th Maths');

    // 5. Scenario D: Student 4 - School Academic Subject + Independent Skill Course (Dual Education Model)
    console.log('\n5. Testing Scenario D: School subjects (10th Maths) + Skill Course (Drawing)...');
    const s4Code = `T-S4-${Date.now().toString().slice(-4)}`;
    const student4 = await prisma.student.create({
      data: {
        firstName: 'Meera',
        lastName: 'Nair',
        studentCode: s4Code,
        admissionNumber: `ADM-${s4Code}`,
        attendanceCode: `${Math.floor(100 + Math.random() * 899)}`,
        dob: new Date('2010-02-18'),
        gender: 'FEMALE',
      },
    });

    await prisma.studentBatchEnrollment.createMany({
      data: [
        { studentId: student4.id, batchId: batch10A.id, subjectId: sub10Maths.id, isActive: true },
        { studentId: student4.id, batchId: batchDrawWeekend.id, subjectId: null, isActive: true },
      ],
    });

    const s4Enrollments = await prisma.studentBatchEnrollment.findMany({
      where: { studentId: student4.id, isActive: true },
      include: { batch: { include: { class: true } } },
    });

    const hasAcademic = s4Enrollments.some((e) => e.batch.class.category === CourseCategory.ACADEMIC);
    const hasSkill = s4Enrollments.some((e) => e.batch.class.category === CourseCategory.SKILL);
    assert(hasAcademic && hasSkill, 'Student 4 holds active enrollments across both ACADEMIC and SKILL models');

    // 6. Scenario E: Student 5 - Enrolled ONLY in Skill Course (Spoken English)
    console.log('\n6. Testing Scenario E: Student enrolled ONLY in Spoken English skill course...');
    const s5Code = `T-S5-${Date.now().toString().slice(-4)}`;
    const student5 = await prisma.student.create({
      data: {
        firstName: 'Kiran',
        lastName: 'Patel',
        studentCode: s5Code,
        admissionNumber: `ADM-${s5Code}`,
        attendanceCode: `${Math.floor(100 + Math.random() * 899)}`,
        dob: new Date('2005-11-25'),
        gender: 'MALE',
      },
    });

    await prisma.studentBatchEnrollment.create({
      data: {
        studentId: student5.id,
        batchId: batchSpokenEvening.id,
        subjectId: null,
        isActive: true,
      },
    });

    const s5Classes = await prisma.studentBatchEnrollment.findMany({
      where: { studentId: student5.id },
      include: { batch: { include: { class: true } } },
    });
    assert(
      s5Classes.length === 1 && s5Classes[0].batch.class.category === CourseCategory.SKILL,
      'Student 5 enrolled solely in independent skill course without school-standard requirement',
    );

    // 7. Scenario F: Multi-Standard Faculty Assignment
    console.log('\n7. Testing Scenario F: Faculty assigned to Maths across multiple standards...');
    let teacher = await prisma.user.findFirst({ where: { email: 'teacher.multi@rcacademy.com' } });
    if (!teacher) {
      teacher = await prisma.user.create({
        data: {
          email: 'teacher.multi@rcacademy.com',
          passwordHash: '$2b$10$xyz',
          firstName: 'Suresh',
          lastName: 'Rao',
          phone: '+919988776655',
          status: 'ACTIVE',
        },
      });
    }

    // Assign Suresh to 10th Maths AND 12th Maths
    await prisma.staffCourseAssignment.deleteMany({ where: { userId: teacher.id } });
    await prisma.staffCourseAssignment.create({
      data: {
        userId: teacher.id,
        classId: std10.id,
        subjectId: sub10Maths.id,
        batchId: batch10A.id,
        isActive: true,
      },
    });

    await prisma.staffCourseAssignment.create({
      data: {
        userId: teacher.id,
        classId: std12.id,
        subjectId: sub12Maths.id,
        batchId: batch12A.id,
        isActive: true,
      },
    });

    const teacherAssignments = await prisma.staffCourseAssignment.findMany({
      where: { userId: teacher.id, isActive: true },
      include: { class: true, subject: true },
    });

    assert(teacherAssignments.length === 2, 'Teacher holds distinct assignments across different standards');
    assert(
      teacherAssignments.some((a) => a.classId === std10.id && a.subject?.code === 'T10MTH') &&
      teacherAssignments.some((a) => a.classId === std12.id && a.subject?.code === 'T12MTH'),
      'Teacher correctly mapped to 10th Maths and 12th Maths independently',
    );

    // 8. Scenario G: Attendance Eligibility Partitioning
    console.log('\n8. Testing Scenario G: Attendance Eligibility Partitioning...');
    // Create an attendance session for 10th Maths
    const session10Maths = await prisma.attendanceSession.create({
      data: {
        classId: std10.id,
        batchId: batch10A.id,
        subjectId: sub10Maths.id,
        date: new Date(),
        status: SessionStatus.OPEN,
        createdById: teacher.id,
      },
    });

    // Create a student enrolled ONLY in 10th English:
    const sEnglishOnly = await prisma.student.create({
      data: {
        firstName: 'Kavita',
        lastName: 'Sen',
        studentCode: `T-ENG-${Date.now().toString().slice(-4)}`,
        admissionNumber: `ADM-ENG-${Date.now().toString().slice(-4)}`,
        attendanceCode: `${Math.floor(100 + Math.random() * 899)}`,
        dob: new Date('2010-08-10'),
        gender: 'FEMALE',
      },
    });
    await prisma.studentBatchEnrollment.create({
      data: {
        studentId: sEnglishOnly.id,
        batchId: batch10A.id,
        subjectId: sub10English.id,
        isActive: true,
      },
    });

    // Eligible candidates query matches AttendanceService logic:
    const eligibleForMaths = await prisma.studentBatchEnrollment.findMany({
      where: {
        ...(session10Maths.batchId ? { batchId: session10Maths.batchId } : {}),
        isActive: true,
        OR: [
          { subjectId: session10Maths.subjectId },
          { subjectId: null },
        ],
      },
    });

    const eligibleIds = eligibleForMaths.map((e) => e.studentId);
    assert(eligibleIds.includes(student1.id), '10th Maths student IS eligible for 10th Maths session');
    assert(eligibleIds.includes(student2.id), '10th Maths+English student IS eligible for 10th Maths session');
    assert(!eligibleIds.includes(sEnglishOnly.id), '10th English-only student is NOT eligible for 10th Maths session');

    // 9. Scenario H: Examination Candidate Partitioning
    console.log('\n9. Testing Scenario H: Examination Candidate Partitioning...');
    const exam10Maths = await prisma.examination.create({
      data: {
        title: '10th Standard Mathematics Midterm',
        classId: std10.id,
        batchId: batch10A.id,
        subjectId: sub10Maths.id,
        academicYearId: academicYear.id,
        totalMarks: new Decimal(100),
        passMarks: new Decimal(40),
        durationMinutes: 90,
        date: new Date(),
        status: 'SCHEDULED',
      },
    });

    // Candidate query matches ExaminationsService logic:
    const examCandidates = await prisma.studentBatchEnrollment.findMany({
      where: {
        isActive: true,
        ...(exam10Maths.batchId ? { batchId: exam10Maths.batchId } : {}),
        OR: [
          { subjectId: exam10Maths.subjectId },
          { subjectId: null },
        ],
      },
      include: { student: true },
    });

    const candidateStudentIds = examCandidates.map((c) => c.studentId);
    assert(candidateStudentIds.includes(student1.id), '10th Maths student is an exam candidate');
    assert(!candidateStudentIds.includes(sEnglishOnly.id), '10th English-only student is EXCLUDED from Maths exam');

    // 10. Scenario I: Duplicate Enrollment Prevention
    console.log('\n10. Testing Scenario I: Duplicate Enrollment Prevention...');
    let duplicateErrorThrown = false;
    try {
      await prisma.studentBatchEnrollment.create({
        data: {
          studentId: student1.id,
          batchId: batch10A.id,
          subjectId: sub10Maths.id,
          isActive: true,
        },
      });
    } catch (err: any) {
      duplicateErrorThrown = true;
    }
    assert(duplicateErrorThrown, 'Unique index prevents duplicate active enrollment in identical batch & subject');

    // 11. Scenario J: Lifecycle Management - Ending one enrollment without deleting profile
    console.log('\n11. Testing Scenario J: Deactivate one enrollment without affecting others...');
    // Deactivate English enrollment for Student 2
    await prisma.studentBatchEnrollment.update({
      where: { id: en2_english.id },
      data: { isActive: false, endDate: new Date() },
    });

    const s2UpdatedEnrollments = await prisma.studentBatchEnrollment.findMany({
      where: { studentId: student2.id },
    });
    const s2Active = s2UpdatedEnrollments.filter((e) => e.isActive);
    const s2Inactive = s2UpdatedEnrollments.filter((e) => !e.isActive);

    assert(s2Active.length === 1 && s2Active[0].subjectId === sub10Maths.id, 'Maths enrollment remains active');
    assert(s2Inactive.length === 1 && s2Inactive[0].subjectId === sub10English.id, 'English enrollment is inactive');

    const s2Profile = await prisma.student.findUnique({ where: { id: student2.id } });
    assert(s2Profile !== null, 'Student profile preserved intact when enrollment is ended');

    // 12. Scenario K: Unique 3-digit attendance codes preserved
    console.log('\n12. Testing Scenario K: Attendance code uniqueness & preservation...');
    const allStudents = [student1, student2, student3, student4, student5, sEnglishOnly];
    const codes = allStudents.map((s) => s.attendanceCode);
    const uniqueCodes = new Set(codes);
    assert(codes.length === uniqueCodes.size, 'All created students have distinct unique attendance codes');

    console.log('\n=============================================================');
    console.log(` SUMMARY: ${passedTests} of ${totalTests} INTEGRATION CHECKS PASSED`);
    console.log('=============================================================\n');

    if (passedTests === totalTests) {
      console.log('>> ALL CORE BUSINESS MODEL REQUIREMENTS VERIFIED SUCCESSFULLY <<\n');
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
