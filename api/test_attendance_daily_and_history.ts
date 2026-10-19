import { PrismaClient, AttendanceStatus, SessionType, SessionStatus, Gender, StudentStatus, ScheduleDayOfWeek, ScheduleExceptionStatus } from '@prisma/client';
import { AttendanceService } from './src/modules/attendance/attendance.service';
import { AttendanceCodeService } from './src/modules/attendance/attendance-code.service';

const prisma = new PrismaClient();
const codeService = new AttendanceCodeService(prisma as any);
const attendanceService = new AttendanceService(prisma as any, codeService);

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting RCA2.O Attendance Daily & History Tests');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} - ${detail || 'Assertion failed'}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // SETUP: Test Academic Year, Standard, Subject, Batch, Staff, Students
    // ----------------------------------------------------
    console.log('--- Step 0: Initializing Test Context ---');
    let ay = await prisma.academicYear.findFirst();
    if (!ay) {
      ay = await prisma.academicYear.create({
        data: {
          name: `AY-Att-${Date.now()}`,
          startDate: new Date('2026-04-01'),
          endDate: new Date('2027-03-31'),
        },
      });
    }

    const testStandard = await prisma.class.create({
      data: {
        academicYearId: ay.id,
        name: `11th Standard Att-${Date.now()}`,
        code: `CLS-ATT-${Date.now().toString().slice(-4)}`,
      },
    });

    const testSubject = await prisma.subject.create({
      data: {
        classId: testStandard.id,
        name: 'Chemistry Daily',
        code: `CHEM-D-${Date.now().toString().slice(-4)}`,
      },
    });

    const testBatch = await prisma.batch.create({
      data: {
        classId: testStandard.id,
        name: `Batch Chem Morning-${Date.now().toString().slice(-4)}`,
      },
    });

    // Clean up any test codes if left over
    await prisma.attendanceCode.deleteMany({ where: { code: { in: ['961', '962', '963'] } } });
    await prisma.student.deleteMany({ where: { attendanceCode: { in: ['961', '962'] } } });
    await prisma.user.deleteMany({ where: { attendanceCode: '963' } });

    // Create a Teacher user
    const teacherUser = await prisma.user.create({
      data: {
        email: `teacher.att.${Date.now()}@rcacademy.com`,
        passwordHash: 'hashed_pw',
        firstName: 'Vikram',
        lastName: 'Sarabhai',
        status: 'ACTIVE',
        attendanceCode: '963',
      },
    });

    // Create an Admin user
    const adminUser = await prisma.user.create({
      data: {
        email: `admin.att.${Date.now()}@rcacademy.com`,
        passwordHash: 'hashed_pw',
        firstName: 'Anand',
        lastName: 'Admin',
        status: 'ACTIVE',
      },
    });

    // Create 2 Students
    const student1 = await prisma.student.create({
      data: {
        studentCode: `STU-ATT1-${Date.now().toString().slice(-4)}`,
        admissionNumber: `ADM-ATT1-${Date.now().toString().slice(-4)}`,
        attendanceCode: '961',
        firstName: 'Priya',
        lastName: 'Raman',
        dob: new Date('2010-02-15'),
        gender: Gender.FEMALE,
        status: StudentStatus.ACTIVE,
      },
    });

    const student2 = await prisma.student.create({
      data: {
        studentCode: `STU-ATT2-${Date.now().toString().slice(-4)}`,
        admissionNumber: `ADM-ATT2-${Date.now().toString().slice(-4)}`,
        attendanceCode: '962',
        firstName: 'Karthik',
        lastName: 'Sundaram',
        dob: new Date('2010-06-20'),
        gender: Gender.MALE,
        status: StudentStatus.ACTIVE,
      },
    });

    // Enroll both students in testBatch
    await prisma.studentBatchEnrollment.createMany({
      data: [
        { studentId: student1.id, batchId: testBatch.id, isActive: true },
        { studentId: student2.id, batchId: testBatch.id, isActive: true },
      ],
    });

    // Assign codes in AttendanceCode table
    await prisma.attendanceCode.createMany({
      data: [
        { code: '963', entityType: 'STAFF', userId: teacherUser.id },
        { code: '961', entityType: 'STUDENT', studentId: student1.id },
        { code: '962', entityType: 'STUDENT', studentId: student2.id },
      ],
    });

    // ----------------------------------------------------
    // TEST 1: Timezone Resolution & Date Boundaries
    // ----------------------------------------------------
    console.log('\n--- Step 1: Timezone & Date Resolution ---');
    const tzInfo = await attendanceService.getAcademyTodayDateString();
    assert(!!tzInfo.dateStr, '1.1 Today date string resolved', tzInfo.dateStr);
    assert(tzInfo.timezone === 'Asia/Kolkata', '1.2 Configured timezone is Asia/Kolkata', tzInfo.timezone);
    assert(!!tzInfo.dayOfWeek, '1.3 Day of week resolved accurately', tzInfo.dayOfWeek);

    // ----------------------------------------------------
    // TEST 2: Today's Scheduled Classes & Daily Exceptions
    // ----------------------------------------------------
    console.log('\n--- Step 2: Schedule & Daily Exceptions Resolution ---');
    // Create an active recurring class schedule for today's day of week
    const classSchedule = await prisma.classSchedule.create({
      data: {
        classId: testStandard.id,
        subjectId: testSubject.id,
        batchId: testBatch.id,
        staffId: teacherUser.id,
        dayOfWeek: tzInfo.dayOfWeek,
        startTime: '09:00',
        endTime: '10:30',
        room: 'Lab 3',
        isActive: true,
      },
    });

    // Create a second recurring schedule that is cancelled today
    const cancelledSchedule = await prisma.classSchedule.create({
      data: {
        classId: testStandard.id,
        subjectId: testSubject.id,
        batchId: testBatch.id,
        staffId: teacherUser.id,
        dayOfWeek: tzInfo.dayOfWeek,
        startTime: '11:00',
        endTime: '12:30',
        room: 'Room 101',
        isActive: true,
      },
    });

    // Add exception cancelling the 11:00 class
    await prisma.dailyScheduleException.create({
      data: {
        date: tzInfo.dateObj,
        scheduleId: cancelledSchedule.id,
        classId: testStandard.id,
        subjectId: testSubject.id,
        batchId: testBatch.id,
        staffId: teacherUser.id,
        startTime: '11:00',
        endTime: '12:30',
        status: ScheduleExceptionStatus.CANCELLED,
        cancellationReason: 'Scheduled maintenance of Room 101',
      },
    });

    const adminOverview = await attendanceService.getTodayClassesAndSessions(adminUser.id, false);
    assert(adminOverview.summary.classesScheduledToday >= 1, '2.1 Admin overview computes scheduled classes');
    
    const activeClassCard = adminOverview.classes.find((c: any) => c.scheduleId === classSchedule.id);
    assert(!!activeClassCard, '2.2 Active class schedule is present in today classes');
    assert(activeClassCard?.sessionStatus === 'NOT_STARTED', '2.3 Unstarted class has status NOT_STARTED');
    assert(activeClassCard?.eligibleStudentCount === 2, '2.4 Correct eligible student count (2)');

    const cancelledCard = adminOverview.classes.find((c: any) => c.scheduleId === cancelledSchedule.id);
    assert(!!cancelledCard && cancelledCard.isCancelled === true, '2.5 Cancelled class has isCancelled: true');
    assert(cancelledCard?.sessionStatus === 'CANCELLED', '2.6 Cancelled class has sessionStatus CANCELLED');
    assert(cancelledCard?.cancellationReason === 'Scheduled maintenance of Room 101', '2.7 Cancellation reason preserved');

    // Test Teacher filtering:
    const teacherOverview = await attendanceService.getTodayClassesAndSessions(teacherUser.id, true);
    const teacherClasses = teacherOverview.classes.filter((c: any) => c.teacherId === teacherUser.id);
    assert(teacherClasses.length === teacherOverview.classes.length, '2.8 Teacher overview strictly scoped to teacher assignments');

    // ----------------------------------------------------
    // TEST 3: Starting Attendance Session & Idempotency
    // ----------------------------------------------------
    console.log('\n--- Step 3: Start Class Session & Duplicate Prevention ---');
    const session1 = await attendanceService.startClassSession(
      {
        scheduleId: classSchedule.id,
        batchId: testBatch.id,
        classId: testStandard.id,
        subjectId: testSubject.id,
        startTime: '09:00',
        endTime: '10:30',
      },
      teacherUser.id,
      true,
    );
    assert(!!session1.id, '3.1 Attendance session started successfully');
    assert(session1.status === SessionStatus.OPEN, '3.2 Session status is OPEN');

    // Call startClassSession again (Idempotency test)
    const sessionRetry = await attendanceService.startClassSession(
      {
        scheduleId: classSchedule.id,
        batchId: testBatch.id,
        classId: testStandard.id,
        subjectId: testSubject.id,
        startTime: '09:00',
        endTime: '10:30',
      },
      teacherUser.id,
      true,
    );
    assert(sessionRetry.id === session1.id, '3.3 Idempotent startClassSession returns exact same session (no duplicate)');

    // ----------------------------------------------------
    // TEST 4: Student Attendance Marking & Duplicate Prevention
    // ----------------------------------------------------
    console.log('\n--- Step 4: Quick Mark & Duplicate Detection ---');
    // Quick mark student 1 using 3-digit code
    const markRes1 = await attendanceService.quickMark(
      {
        studentCode: '961',
        sessionId: session1.id,
      },
      teacherUser.id,
    );
    assert(markRes1.alreadyMarked === false, '4.1 Student 1 scanned and marked successfully');
    assert(markRes1.record.status === AttendanceStatus.PRESENT, '4.2 Student 1 recorded as PRESENT');

    // Duplicate scan of student 1
    const dupRes = await attendanceService.quickMark(
      {
        studentCode: '961',
        sessionId: session1.id,
      },
      teacherUser.id,
    );
    assert(dupRes.alreadyMarked === true, '4.3 Duplicate scan returns alreadyMarked: true');
    assert(dupRes.record.id === markRes1.record.id, '4.4 Duplicate scan preserves original record ID');

    // Manual mark student 2 as LATE
    const markRes2 = await attendanceService.markStudent(
      {
        sessionId: session1.id,
        studentId: student2.id,
        status: AttendanceStatus.LATE,
      },
      teacherUser.id,
      true,
    );
    assert(markRes2.status === AttendanceStatus.LATE, '4.5 Student 2 manually marked as LATE');

    // Cross-terminal protection: Staff code scanned on student terminal
    let staffScanOnStudentRejected = false;
    try {
      await attendanceService.quickMark(
        {
          studentCode: '963', // Staff code
          sessionId: session1.id,
        },
        teacherUser.id,
      );
    } catch (e: any) {
      staffScanOnStudentRejected = true;
    }
    assert(staffScanOnStudentRejected, '4.6 Staff attendance code rejected on student scanner');

    // ----------------------------------------------------
    // TEST 5: Progress Metrics & Session Closure
    // ----------------------------------------------------
    console.log('\n--- Step 5: Live Metrics & Session Closure ---');
    const midSessionOverview = await attendanceService.getTodayClassesAndSessions(adminUser.id, false);
    const inProgressClass = midSessionOverview.classes.find((c: any) => c.scheduleId === classSchedule.id);
    assert(inProgressClass?.sessionStatus === 'OPEN', '5.1 Class status updated to OPEN in live view');
    assert(inProgressClass?.presentCount === 1, '5.2 Present count is 1');
    assert(inProgressClass?.lateCount === 1, '5.3 Late count is 1');
    assert(inProgressClass?.unmarkedCount === 0, '5.4 Unmarked count is 0');
    assert(inProgressClass?.attendanceRate === 100, '5.5 Attendance rate is 100%');

    // Close session
    const closedSession = await attendanceService.closeSession(
      session1.id,
      { markUnmarkedAsAbsent: true },
      teacherUser.id,
    );
    assert(closedSession.status === SessionStatus.CLOSED, '5.6 Session successfully CLOSED');

    // Reject new scans on closed session
    let scanOnClosedRejected = false;
    try {
      await attendanceService.quickMark(
        {
          studentCode: student1.studentCode,
          sessionId: session1.id,
        },
        teacherUser.id,
      );
    } catch (e: any) {
      scanOnClosedRejected = true;
    }
    assert(scanOnClosedRejected, '5.7 Quick marking rejected after session closure');

    // ----------------------------------------------------
    // TEST 6: Attendance Corrections & Audit Trail
    // ----------------------------------------------------
    console.log('\n--- Step 6: Attendance Correction & Audit History ---');
    const correctionRes = await attendanceService.createCorrection(
      {
        recordId: markRes2.id,
        newStatus: AttendanceStatus.EXCUSED,
        reason: 'Authorized medical exemption submitted by guardian',
      },
      teacherUser.id,
    );
    assert(correctionRes.record.status === AttendanceStatus.EXCUSED, '6.1 Status corrected to EXCUSED');
    assert(correctionRes.correction.previousStatus === AttendanceStatus.LATE, '6.2 Previous status logged as LATE');
    assert(correctionRes.correction.reason.includes('medical'), '6.3 Correction reason recorded');

    // Check AuditLog
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        action: 'ATTENDANCE_CORRECTION',
        entityId: markRes2.id,
      },
    });
    assert(!!auditLog, '6.4 AuditLog entry created for attendance correction');

    // ----------------------------------------------------
    // TEST 7: Attendance History & Search Filters
    // ----------------------------------------------------
    console.log('\n--- Step 7: Attendance History Filtering & Pagination ---');
    const historyAll = await attendanceService.getAttendanceHistory(
      {
        classId: testStandard.id,
        batchId: testBatch.id,
        page: 1,
        limit: 10,
      },
      adminUser.id,
      false,
    );
    assert(historyAll.pagination.total === 2, '7.1 History returns exactly 2 records for test batch');
    assert(historyAll.summary.presentCount === 1, '7.2 History summary shows 1 PRESENT');
    assert(historyAll.summary.excusedCount === 1, '7.3 History summary shows 1 EXCUSED');

    // Filter by studentQuery
    const historyFiltered = await attendanceService.getAttendanceHistory(
      {
        studentQuery: 'Priya',
        batchId: testBatch.id,
      },
      adminUser.id,
      false,
    );
    assert(historyFiltered.records.length === 1, '7.4 Filter by student name returns Priya');
    assert(historyFiltered.records[0].studentCode === student1.studentCode, '7.5 Student identity verified');

    // ----------------------------------------------------
    // TEST 8: Staff Attendance Terminal & History
    // ----------------------------------------------------
    console.log('\n--- Step 8: Staff Attendance Workflow ---');
    // Tap 1: Check-in
    const staffCheckIn = await attendanceService.staffQuickMark(
      { code: '963' },
      teacherUser.id,
    );
    assert(staffCheckIn.type === 'CHECK_IN', '8.1 First tap performs staff CHECK_IN');
    assert(staffCheckIn.staff.id === teacherUser.id, '8.2 Teacher identity resolved from code 963');

    // Tap 2: Check-out
    const staffCheckOut = await attendanceService.staffQuickMark(
      { code: '963' },
      teacherUser.id,
    );
    assert(staffCheckOut.type === 'CHECK_OUT', '8.3 Second tap performs staff CHECK_OUT');
    assert(!!staffCheckOut.record.checkOutAt, '8.4 Check-out timestamp recorded');

    // Reject student code on staff terminal
    let studentScanOnStaffRejected = false;
    try {
      await attendanceService.staffQuickMark(
        { code: '961' }, // Student code
        teacherUser.id,
      );
    } catch (e: any) {
      studentScanOnStaffRejected = true;
    }
    assert(studentScanOnStaffRejected, '8.5 Student attendance code rejected on staff terminal');

    // Query staff attendance records
    const staffRecords = await attendanceService.getStaffAttendanceRecords({
      userId: teacherUser.id,
    });
    assert(staffRecords.length === 1, '8.6 Staff record retrieved for today');
    assert(staffRecords[0].checkInAt !== null && staffRecords[0].checkOutAt !== null, '8.7 Duration tracked with in & out times');

    // ----------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------
    console.log('\n--- Cleaning up test records ---');
    await prisma.attendanceCorrection.deleteMany({ where: { recordId: { in: [markRes1.record.id, markRes2.id] } } });
    await prisma.attendanceRecord.deleteMany({ where: { sessionId: session1.id } });
    await prisma.attendanceSession.deleteMany({ where: { id: session1.id } });
    await prisma.staffAttendanceRecord.deleteMany({ where: { userId: teacherUser.id } });
    await prisma.attendanceCode.deleteMany({ where: { code: { in: ['961', '962', '963'] } } });
    await prisma.dailyScheduleException.deleteMany({ where: { scheduleId: cancelledSchedule.id } });
    await prisma.classSchedule.deleteMany({ where: { id: { in: [classSchedule.id, cancelledSchedule.id] } } });
    await prisma.studentBatchEnrollment.deleteMany({ where: { batchId: testBatch.id } });
    await prisma.student.deleteMany({ where: { id: { in: [student1.id, student2.id] } } });
    await prisma.batch.delete({ where: { id: testBatch.id } });
    await prisma.subject.delete({ where: { id: testSubject.id } });
    await prisma.class.delete({ where: { id: testStandard.id } });
    await prisma.user.deleteMany({ where: { id: { in: [teacherUser.id, adminUser.id] } } });

    console.log('\n====================================================');
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during integration test:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
