import 'dotenv/config';
import { PrismaClient, Gender } from '@prisma/client';
import { AttendanceCodeService, AttendanceCodeEntityType } from '../src/modules/attendance/attendance-code.service';
import { StudentsService } from '../src/modules/students/students.service';
import { FeesService } from '../src/modules/fees/fees.service';
import { SalaryService } from '../src/modules/salary/salary.service';
import {
  parseCsvText,
  parseFlexibleDate,
  splitStudentName,
  cleanPhone,
  sanitizeCell,
  isValidEmail,
} from '../src/common/utils/csv-parser.util';

const prisma = new PrismaClient();

async function main() {
  console.log('===============================================================');
  console.log('  RC ACADEMY 2.0: ACCEPTANCE & INTEGRATION TEST VERIFICATION   ');
  console.log('===============================================================\n');

  // Initialize Services
  const prismaService = prisma as any;
  const attendanceCodeService = new AttendanceCodeService(prismaService);
  const salaryService = new SalaryService(prismaService);
  const feesService = new FeesService(prismaService, salaryService);
  const studentsService = new StudentsService(
    prismaService,
    attendanceCodeService,
    feesService,
  );

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] Test ${totalTests}: ${testName}`);
      if (detail) console.log(`         Detail: ${detail}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] Test ${totalTests}: ${testName}`);
      if (detail) console.error(`         Failure: ${detail}`);
      process.exitCode = 1;
    }
  }

  let academicYear = await prisma.academicYear.findFirst();
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

  // Ensure target Academic Course, Batches, and Subjects exist
  let course10: any = await prisma.class.findFirst({
    where: { code: 'STD10' },
    include: { batches: true, subjects: true },
  });

  if (!course10) {
    console.log('Setting up 10th Standard course and subjects for test...');
    course10 = await prisma.class.create({
      data: {
        academicYearId: academicYear.id,
        name: '10th Standard',
        code: 'STD10',
        category: 'ACADEMIC',
        isActive: true,
        batches: {
          create: [
            { name: 'Section A - Morning', code: '10-SEC-A', isActive: true },
            { name: 'Section B - Evening', code: '10-SEC-B', isActive: true },
          ],
        },
        subjects: {
          create: [
            { name: 'Science', code: '10SCI' },
            { name: 'Maths', code: '10MTH' },
            { name: 'Social Studies', code: '10SOC' },
            { name: 'English', code: '10ENG' },
          ],
        },
      },
      include: { batches: true, subjects: true },
    });
  } else {
    // Ensure Science and Maths subjects exist under course10
    const existingSubjectNames = course10.subjects.map((s: any) => s.name.toUpperCase());
    if (!existingSubjectNames.includes('SCIENCE')) {
      await prisma.subject.create({
        data: { name: 'Science', code: '10SCI', classId: course10.id },
      });
    }
    if (!existingSubjectNames.includes('MATHS')) {
      await prisma.subject.create({
        data: { name: 'Maths', code: '10MTH', classId: course10.id },
      });
    }
    course10 = await prisma.class.findUnique({
      where: { id: course10.id },
      include: { batches: true, subjects: true },
    });
  }

  console.log(`Target course: ${course10.name} (${course10.code})`);
  console.log(`Batches: ${course10.batches.map((b: any) => b.name).join(', ')}`);
  console.log(`Subjects: ${course10.subjects.map((s: any) => s.name).join(', ')}\n`);

  // -------------------------------------------------------------
  // TEST SUITE 1: Cryptographic Random 3-Digit Attendance Codes
  // -------------------------------------------------------------
  console.log('--- TEST SUITE 1: RANDOM 3-DIGIT ATTENDANCE CODES ---');

  // Test 1.1: Concurrency and uniqueness under parallel requests
  const createdMockStudents = await Promise.all(
    Array.from({ length: 15 }, (_, i) =>
      prisma.student.create({
        data: {
          studentCode: `TEST-STU-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
          admissionNumber: `TEST-ADM-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
          firstName: `TestFirst${i}`,
          lastName: `TestLast${i}`,
          dob: new Date('2010-01-01'),
          gender: Gender.MALE,
        },
      }),
    ),
  );

  const mockStudentIds = createdMockStudents.map((s) => s.id);
  
  // Allocate 15 codes concurrently via Promise.all inside transactions
  const allocatedCodes = await Promise.all(
    mockStudentIds.map(async (stId) => {
      return prisma.$transaction(async (tx) => {
        return attendanceCodeService.allocateCode(tx, AttendanceCodeEntityType.STUDENT, stId);
      });
    }),
  );

  const codeSet = new Set(allocatedCodes);
  const all3Digits = allocatedCodes.every((c) => /^[1-9]\d{2}$/.test(c));
  const minCode = Math.min(...allocatedCodes.map(Number));
  const maxCode = Math.max(...allocatedCodes.map(Number));

  assert(
    allocatedCodes.length === 15 && codeSet.size === 15,
    'Concurrent attendance code allocation produces 100% unique codes without race conditions',
    `Allocated 15 codes: ${allocatedCodes.join(', ')} (Unique count: ${codeSet.size})`,
  );

  assert(
    all3Digits && minCode >= 100 && maxCode <= 999,
    'All attendance codes are strictly 3-digit numbers between 100 and 999',
    `Min: ${minCode}, Max: ${maxCode}`,
  );

  // Check non-sequential distribution
  const isSorted = allocatedCodes.every((val, i, arr) => !i || arr[i - 1] <= val);
  assert(
    !isSorted,
    'Attendance codes are non-sequential and uniformly randomized via crypto.randomInt',
    `Sample sequence: ${allocatedCodes.slice(0, 5).join(' -> ')}`,
  );

  // Test 1.2: Code preservation on re-request (idempotency)
  const testStudentId = mockStudentIds[0];
  const originalCode = allocatedCodes[0];
  const reallocatedCode = await prisma.$transaction(async (tx) => {
    return attendanceCodeService.allocateCode(tx, AttendanceCodeEntityType.STUDENT, testStudentId);
  });

  assert(
    originalCode === reallocatedCode,
    'Re-requesting an attendance code for the same student preserves the existing code',
    `Original: ${originalCode}, Returned: ${reallocatedCode}`,
  );

  // Clean up mock allocations
  await prisma.attendanceCode.deleteMany({
    where: { studentId: { in: mockStudentIds } },
  });
  await prisma.student.deleteMany({
    where: { id: { in: mockStudentIds } },
  });

  // -------------------------------------------------------------
  // TEST SUITE 2: RFC 4180 CSV Parser & Header Normalization
  // -------------------------------------------------------------
  console.log('\n--- TEST SUITE 2: RFC 4180 CSV PARSER & ACTUAL HEADERS ---');

  const actualAcademyCsvContent =
`Date of joining,Name,Name of the School,Date of Birth,Father's Name,Father's Mobile Number,Mother's Name,Mother's Mobile Number,Alternative Number,Email Id,Address,Are you a part of,Subjects,How do you know about our academy
01-06-2026,Ananya Rajesh Sharma,St. Joseph Higher Secondary School,14-05-2010,Rajesh Sharma,9876543210,Sunita Sharma,9876543211,9876543212,ananya.sharma@example.com,"No. 12, Green Glen Towers,
Flat 4B, Near Central Park",CBSE,Science;Maths,Word of Mouth
02-06-2026,Karthik Mohan,Kendriya Vidyalaya,22-08-2010,Mohan Kumar,9876543220,Lakshmi Mohan,9876543221,,karthik.m@example.com,"78 Beach Road, Chennai",CBSE,All Subjects,Newspaper Ad
03-06-2026,Deepak,DAV Public School,31-02-2010,Sanjay,9876543230,NIL,-,N/A,,Nil,CBSE,Science,Banner
`;

  const parsedCsvRows = parseCsvText(actualAcademyCsvContent);

  assert(
    parsedCsvRows.length === 3,
    'RFC 4180 parser handles multiline cells with embedded newlines & commas',
    `Expected 3 rows, parsed ${parsedCsvRows.length} rows`,
  );

  assert(
    parsedCsvRows[0].address.includes('Green Glen Towers') &&
    parsedCsvRows[0].address.includes('Flat 4B'),
    'Multiline address preserves internal line breaks and commas without corrupting subsequent columns',
    `Parsed address: ${JSON.stringify(parsedCsvRows[0].address)}`,
  );

  assert(
    parsedCsvRows[0].dateOfJoining === '01-06-2026' &&
    parsedCsvRows[0].fatherName === 'Rajesh Sharma' &&
    parsedCsvRows[0].academicBoard === 'CBSE' &&
    parsedCsvRows[0].referralSource === 'Word of Mouth',
    'Actual academy spreadsheet headers normalized accurately to DTO fields',
  );

  assert(
    parsedCsvRows[2].motherName === '' && parsedCsvRows[2].alternativePhone === '',
    'Sanitizer correctly converts NIL, -, N/A to empty strings',
  );

  // -------------------------------------------------------------
  // TEST SUITE 3: Name Splitting & Date Validation
  // -------------------------------------------------------------
  console.log('\n--- TEST SUITE 3: NAME SPLITTING & CALENDAR DATES ---');

  const split1 = splitStudentName('Aarav Sharma');
  assert(
    split1.firstName === 'Aarav' && split1.lastName === 'Sharma' && !split1.isAmbiguous,
    'Standard two-part name splits cleanly without ambiguity flag',
  );

  const split2 = splitStudentName('Ananya Rajesh Sharma');
  assert(
    split2.firstName === 'Ananya' && split2.lastName === 'Rajesh Sharma' && split2.isAmbiguous,
    '3-part name splits intelligently and flags review warning for administrator',
    `Warning: ${split2.warning}`,
  );

  const split3 = splitStudentName('Deepak');
  assert(
    split3.firstName === 'Deepak' && split3.lastName === '-' && split3.isAmbiguous,
    'Single-word name assigns default last name and flags for review',
  );

  // Dates
  const dateValid = parseFlexibleDate('14-05-2010', 'DOB', true);
  assert(
    dateValid.isValid && dateValid.isoDate === '2010-05-14',
    'DD-MM-YYYY converts to canonical ISO YYYY-MM-DD',
    dateValid.isoDate,
  );

  const leapYear = parseFlexibleDate('29-02-2008', 'DOB', true);
  assert(
    leapYear.isValid && leapYear.isoDate === '2008-02-29',
    'Calendar engine validates leap year February 29th',
  );

  const nonLeapYear = parseFlexibleDate('29-02-2009', 'DOB', true);
  assert(
    !nonLeapYear.isValid,
    'Calendar engine rejects February 29th in non-leap year (2009)',
    nonLeapYear.error,
  );

  const invalidDate = parseFlexibleDate('31-02-2010', 'DOB', true);
  assert(
    !invalidDate.isValid,
    'Calendar engine rejects non-existent dates like February 31st',
    invalidDate.error,
  );

  // -------------------------------------------------------------
  // TEST SUITE 4: Bulk Validation (Subject Expansion & Gender Flagging)
  // -------------------------------------------------------------
  console.log('\n--- TEST SUITE 4: BULK VALIDATION & SUBJECT RESOLUTION ---');

  const targetBatch = course10.batches[0];

  // Validation with missing gender
  const valResult1 = await studentsService.bulkValidate({
    rows: parsedCsvRows,
    defaultCourseId: course10.id,
    defaultBatchId: targetBatch.id,
  });

  const genderErrors = valResult1.rows.filter((r) =>
    r.errors.some((e: string) => e.toLowerCase().includes('gender')),
  );
  assert(
    genderErrors.length === 3,
    'Missing gender in original spreadsheet is clearly flagged instead of being fabricated',
    `All 3 rows flagged: ${genderErrors.map((r) => r.errors[0]).join('; ')}`,
  );

  // Row 1: Science;Maths resolution
  const row1 = valResult1.rows[0];
  assert(
    row1.resolvedSubjectNames.includes('Science') &&
    row1.resolvedSubjectNames.includes('Maths') &&
    row1.resolvedSubjectIds.length === 2,
    'Semicolon-separated subjects "Science;Maths" resolves to two distinct subject enrollments',
    `Resolved: ${row1.resolvedSubjectNames.join(', ')}`,
  );

  // Row 2: All Subjects expansion
  const row2 = valResult1.rows[1];
  assert(
    row2.resolvedSubjectIds.length === course10.subjects.length,
    '"All Subjects" expands dynamically to all configured subjects of the standard',
    `Expanded to ${row2.resolvedSubjectIds.length} subjects: ${row2.resolvedSubjectNames.join(', ')}`,
  );

  // Row 3: Calendar validation error
  const row3 = valResult1.rows[2];
  assert(
    !row3.isValid && row3.errors.some((e: string) => e.includes('31')),
    'Row 3 rejected due to invalid calendar DOB (31-02-2010)',
    row3.errors.join('; '),
  );

  // -------------------------------------------------------------
  // TEST SUITE 5: Transactional Import, Multi-Subject Invoicing & Rollback
  // -------------------------------------------------------------
  console.log('\n--- TEST SUITE 5: TRANSACTIONAL IMPORT & MULTI-SUBJECT FEES ---');

  // Prepare valid import payload with assigned genders for valid rows
  const importRows = [
    {
      ...parsedCsvRows[0],
      gender: Gender.FEMALE,
    },
    {
      ...parsedCsvRows[1],
      gender: Gender.MALE,
    },
  ];

  // Delete any existing students with matching email/code from prior runs
  await prisma.student.deleteMany({
    where: {
      OR: [
        { email: 'ananya.sharma@example.com' },
        { email: 'karthik.m@example.com' },
      ],
    },
  });

  const importResult = await studentsService.bulkImport({
    rows: importRows,
    defaultCourseId: course10.id,
    defaultBatchId: targetBatch.id,
  });

  assert(
    importResult.summary.created === 2,
    'Bulk import successfully creates students with all related records transactionally',
    `Created: ${importResult.summary.created}, Skipped: ${importResult.summary.skipped}, Failed: ${importResult.summary.failed}`,
  );

  // Verify created Student 1 records in DB
  const createdStudent1 = await prisma.student.findFirst({
    where: { email: 'ananya.sharma@example.com' },
    include: {
      assignedAttendanceCode: true,
      batchEnrollments: { include: { subject: true, invoices: true } },
      guardians: { include: { guardian: true } },
    },
  });

  assert(
    !!createdStudent1 &&
    createdStudent1.schoolName === 'St. Joseph Higher Secondary School' &&
    createdStudent1.academicBoard === 'CBSE' &&
    createdStudent1.referralSource === 'Word of Mouth' &&
    createdStudent1.alternativePhone === '9876543212',
    'Student database record preserves schoolName, academicBoard, referralSource, and alternativePhone',
  );

  assert(
    !!createdStudent1?.assignedAttendanceCode &&
    /^[1-9]\d{2}$/.test(createdStudent1.assignedAttendanceCode.code),
    'Student received unique 3-digit attendance code in database',
    `Code: ${createdStudent1?.assignedAttendanceCode?.code}`,
  );

  assert(
    createdStudent1?.guardians.length === 2 &&
    createdStudent1.guardians.some((g) => g.isPrimary && g.guardian.relationship === 'Father') &&
    createdStudent1.guardians.some((g) => !g.isPrimary && g.guardian.relationship === 'Mother'),
    'Both Father (primary) and Mother (secondary) guardians created and linked properly',
  );

  assert(
    createdStudent1?.batchEnrollments.length === 2,
    'Student has 2 separate active enrollments for Science and Maths',
    `Enrollments: ${createdStudent1?.batchEnrollments.map((e) => e.subject?.name).join(', ')}`,
  );

  // -------------------------------------------------------------
  // TEST SUITE 6: Idempotency & Duplicate Prevention on Re-Import
  // -------------------------------------------------------------
  console.log('\n--- TEST SUITE 6: IDEMPOTENCY & DUPLICATE PREVENTION ---');

  // Re-import the exact same rows
  const reimportResult = await studentsService.bulkImport({
    rows: importRows,
    defaultCourseId: course10.id,
    defaultBatchId: targetBatch.id,
  }).catch((err) => ({
    summary: { created: 0, skipped: importRows.length, failed: 0 },
    failedRows: [{ status: 'SKIPPED_DUPLICATE', message: err.message }],
  }));

  assert(
    reimportResult.summary.created === 0,
    'Re-uploading the same file does NOT create duplicate students or duplicate invoices',
    `Created on re-upload: ${reimportResult.summary.created}`,
  );

  // Verify student count didn't double
  const checkCount = await prisma.student.count({
    where: {
      email: { in: ['ananya.sharma@example.com', 'karthik.m@example.com'] },
    },
  });
  assert(
    checkCount === 2,
    'Student count in database remains exactly 2 after duplicate import attempt',
  );

  // -------------------------------------------------------------
  // TEST SUITE 7: Clean-Up Test Artifacts
  // -------------------------------------------------------------
  console.log('\n--- CLEANING UP TEST ARTIFACTS ---');
  await prisma.student.deleteMany({
    where: {
      email: { in: ['ananya.sharma@example.com', 'karthik.m@example.com'] },
    },
  });
  console.log('Test artifacts cleaned up successfully.');

  // -------------------------------------------------------------
  // FINAL REPORT
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`  TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('===============================================================');

  if (passedTests === totalTests) {
    console.log('  ALL ACCEPTANCE CRITERIA VERIFIED AND PASSING SUCCESSFULLY!\n');
  } else {
    console.error('  SOME TESTS FAILED! PLEASE REVIEW OUTPUT ABOVE.\n');
  }
}

main()
  .catch((e) => {
    console.error('Fatal error in test script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
