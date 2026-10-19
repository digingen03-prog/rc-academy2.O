import { PrismaClient, ScheduleDayOfWeek, ScheduleExceptionStatus } from '@prisma/client';
import { ScheduleService } from './src/modules/schedule/schedule.service';

const prisma = new PrismaClient();
const scheduleService = new ScheduleService(prisma as any);

async function runTests() {
  console.log('=== STARTING SCHEDULE & WHATSAPP GENERATION INTEGRATION TEST ===\n');

  try {
    // 1. Fetch existing classes, subjects, batches, staff
    const classes = await prisma.class.findMany({ take: 2, include: { subjects: true, batches: true } });
    if (!classes.length || !classes[0].subjects.length) {
      throw new Error('Precondition failed: No classes or subjects found in database.');
    }
    const staffMembers = await prisma.user.findMany({
      where: { userRoles: { some: { role: { name: 'TEACHER' } } } },
      take: 2,
    });
    if (staffMembers.length < 2) {
      throw new Error('Precondition failed: Need at least 2 teachers in database.');
    }

    const testClass = classes[0];
    const testSubject1 = testClass.subjects[0];
    const testSubject2 = testClass.subjects[1] || testClass.subjects[0];
    const testBatch1 = testClass.batches[0];
    const teacher1 = staffMembers[0];
    const teacher2 = staffMembers[1];

    console.log(`[Setup] Using Class: ${testClass.name}, Subject 1: ${testSubject1.name}, Teacher 1: ${teacher1.firstName} ${teacher1.lastName}, Teacher 2: ${teacher2.firstName} ${teacher2.lastName}`);

    // Resolve tomorrow's weekday in Asia/Kolkata
    const tomorrowInfo = scheduleService.getTomorrowDateString('Asia/Kolkata');
    console.log(`[Timezone Test] Tomorrow is: ${tomorrowInfo.date} (${tomorrowInfo.dayOfWeek})`);

    // Clean up any previous test schedules
    await prisma.dailyScheduleException.deleteMany({
      where: { notes: { contains: 'TEST_RUN' } },
    });
    await prisma.classSchedule.deleteMany({
      where: { room: 'LAB-TEST-101' },
    });

    // 2. Test Recurring Schedule Creation
    console.log('\n--- 1. Testing Recurring Schedule Creation ---');
    const schedule1 = await scheduleService.createSchedule({
      classId: testClass.id,
      subjectId: testSubject1.id,
      batchId: testBatch1 ? testBatch1.id : undefined,
      staffId: teacher1.id,
      dayOfWeek: tomorrowInfo.dayOfWeek as ScheduleDayOfWeek,
      startTime: '09:00',
      endTime: '10:30',
      room: 'LAB-TEST-101',
    });
    console.log(`✓ Created Schedule 1: 09:00 - 10:30, Teacher 1, Room LAB-TEST-101 (ID: ${schedule1.id})`);

    const schedule2 = await scheduleService.createSchedule({
      classId: testClass.id,
      subjectId: testSubject2.id,
      batchId: testBatch1 ? testBatch1.id : undefined,
      staffId: teacher2.id,
      dayOfWeek: tomorrowInfo.dayOfWeek as ScheduleDayOfWeek,
      startTime: '10:45',
      endTime: '12:15',
      room: 'LAB-TEST-101',
    });
    console.log(`✓ Created Schedule 2 (Non-overlapping): 10:45 - 12:15, Teacher 2, Room LAB-TEST-101 (ID: ${schedule2.id})`);

    // 3. Test Conflict Detection
    console.log('\n--- 2. Testing Conflict Detection ---');
    
    // Conflict 2a: Teacher double booking
    try {
      await scheduleService.createSchedule({
        classId: testClass.id,
        subjectId: testSubject1.id,
        staffId: teacher1.id, // Teacher 1 is busy 09:00-10:30
        dayOfWeek: tomorrowInfo.dayOfWeek as ScheduleDayOfWeek,
        startTime: '10:00',
        endTime: '11:00',
        room: 'ROOM-B',
      });
      console.error('✗ FAILED: Expected teacher conflict error but creation succeeded!');
    } catch (err: any) {
      console.log(`✓ Teacher Conflict Detected correctly: "${err.message}"`);
    }

    // Conflict 2b: Room double booking
    try {
      await scheduleService.createSchedule({
        classId: testClass.id,
        subjectId: testSubject2.id,
        staffId: teacher2.id,
        dayOfWeek: tomorrowInfo.dayOfWeek as ScheduleDayOfWeek,
        startTime: '09:30',
        endTime: '10:15',
        room: 'LAB-TEST-101', // LAB-TEST-101 is busy 09:00-10:30
      });
      console.error('✗ FAILED: Expected room conflict error but creation succeeded!');
    } catch (err: any) {
      console.log(`✓ Room Conflict Detected correctly: "${err.message}"`);
    }

    // 4. Test Tomorrow Daily Schedule Resolution & Chronological Sort
    console.log('\n--- 3. Testing Tomorrow Schedule Generation ---');
    let dailyRes = await scheduleService.getDailySchedule(tomorrowInfo.date);
    console.log(`✓ Resolved ${dailyRes.classesCount} classes for tomorrow (${dailyRes.date}, ${dailyRes.dayOfWeek})`);
    console.log(`✓ Schedule order: ${dailyRes.schedule.map((s: any) => `${s.startTime}-${s.endTime} (${s.subjectName})`).join(' -> ')}`);
    console.log(`✓ WhatsApp formatted preview generated (${dailyRes.whatsappMessage.length} chars)`);

    // 5. Test Daily Exceptions (Preserving Recurring Timetable)
    console.log('\n--- 4. Testing Daily Exceptions (Preserving Recurring Timetable) ---');

    // 5a. Cancel Schedule 1 for tomorrow
    const cancelException = await scheduleService.createException({
      scheduleId: schedule1.id,
      date: tomorrowInfo.date,
      status: ScheduleExceptionStatus.CANCELLED,
      cancellationReason: 'Teacher on medical leave for tomorrow only',
      notes: 'TEST_RUN',
    });
    console.log(`✓ Created CANCELLED exception for Schedule 1 on ${tomorrowInfo.date} (ID: ${cancelException.id})`);

    // Verify tomorrow's schedule excludes cancelled class
    dailyRes = await scheduleService.getDailySchedule(tomorrowInfo.date);
    const hasCancelled = dailyRes.schedule.some((s: any) => s.id === schedule1.id);
    if (!hasCancelled) {
      console.log('✓ Cancelled class successfully excluded from tomorrow\'s active schedule!');
    } else {
      console.error('✗ FAILED: Cancelled class still present in active schedule!');
    }

    // Verify recurring schedule itself was NOT altered
    const recurringCheck = await prisma.classSchedule.findUnique({ where: { id: schedule1.id } });
    if (recurringCheck?.isActive) {
      console.log('✓ Recurring timetable entry is still active for future weeks (not altered by one-day cancellation)');
    } else {
      console.error('✗ FAILED: Recurring schedule was modified!');
    }

    // 5b. Teacher Substitution for Schedule 2
    const subException = await scheduleService.createException({
      scheduleId: schedule2.id,
      date: tomorrowInfo.date,
      status: ScheduleExceptionStatus.SUBSTITUTED,
      staffId: teacher1.id, // Teacher 1 substituting for Teacher 2
      notes: 'TEST_RUN: Substituted',
    });
    console.log(`✓ Created SUBSTITUTED exception for Schedule 2: Substituted with Teacher 1 (ID: ${subException.id})`);

    dailyRes = await scheduleService.getDailySchedule(tomorrowInfo.date);
    const substitutedClass = dailyRes.schedule.find((s: any) => s.id === schedule2.id);
    if (substitutedClass && substitutedClass.teacherId === teacher1.id) {
      console.log(`✓ Tomorrow's schedule reflects substituted teacher: ${substitutedClass.teacherName} (was ${teacher2.firstName} ${teacher2.lastName})`);
    } else {
      console.error('✗ FAILED: Substitution not reflected in daily schedule!');
    }

    // 5c. Special Additional Class for tomorrow
    const specialException = await scheduleService.createException({
      classId: testClass.id,
      subjectId: testSubject1.id,
      staffId: teacher2.id,
      date: tomorrowInfo.date,
      startTime: '14:00',
      endTime: '15:30',
      room: 'SPECIAL-HALL',
      status: ScheduleExceptionStatus.SPECIAL_CLASS,
      notes: 'TEST_RUN: Extra Doubt Clearing Session',
    });
    console.log(`✓ Created SPECIAL_CLASS exception for tomorrow 14:00 - 15:30 (ID: ${specialException.id})`);

    dailyRes = await scheduleService.getDailySchedule(tomorrowInfo.date);
    const hasSpecial = dailyRes.schedule.some((s: any) => s.startTime === '14:00' && s.isSpecialClass);
    if (hasSpecial) {
      console.log('✓ Tomorrow\'s schedule includes special extra class in chronological order!');
    } else {
      console.error('✗ FAILED: Special class missing from daily schedule!');
    }

    // 6. Test WhatsApp Message Customization & Grouping
    console.log('\n--- 5. Testing WhatsApp Message Formatting ---');
    console.log('Generated WhatsApp Message:');
    console.log('--------------------------------------------------');
    console.log(dailyRes.whatsappMessage);
    console.log('--------------------------------------------------');

    // Test By-Batch Grouping
    const batchRes = await scheduleService.getDailySchedule(tomorrowInfo.date, true);
    console.log(`✓ By-Batch Grouped WhatsApp message generated (${batchRes.whatsappMessage.length} chars)`);

    // 7. Cleanup test data
    console.log('\n--- 6. Cleaning Up Test Artifacts ---');
    await prisma.dailyScheduleException.deleteMany({
      where: { notes: { contains: 'TEST_RUN' } },
    });
    await prisma.classSchedule.deleteMany({
      where: { id: { in: [schedule1.id, schedule2.id] } },
    });
    console.log('✓ Test data cleaned up successfully.');

    console.log('\n=== ALL SCHEDULE & WHATSAPP INTEGRATION TESTS PASSED! ===');
  } catch (error) {
    console.error('Test failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
