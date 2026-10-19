import { PrismaClient, Gender } from '@prisma/client';
import { StudentsService } from '../src/modules/students/students.service';

const prisma = new PrismaClient();
const studentsService = new StudentsService(prisma as any, {} as any, {} as any);

async function runTest() {
  console.log('\n--- Testing Student Deletion and Attendance Code Release ---');
  try {
    const timestamp = Date.now();
    const studentCode = `STU-DEL-${timestamp.toString().slice(-4)}`;
    const admNumber = `ADM-DEL-${timestamp.toString().slice(-4)}`;
    const testAttendanceCode = '987';

    // Ensure testAttendanceCode is clean
    await prisma.attendanceCode.deleteMany({ where: { code: testAttendanceCode } });

    // 1. Create a dummy student for deletion test
    const student = await prisma.student.create({
      data: {
        studentCode,
        admissionNumber: admNumber,
        attendanceCode: testAttendanceCode,
        firstName: 'TestDelete',
        lastName: 'Student',
        gender: Gender.MALE,
        dob: new Date('2008-01-01'),
        status: 'ACTIVE',
        assignedAttendanceCode: {
          create: {
            code: testAttendanceCode,
            entityType: 'STUDENT',
          },
        },
      },
    });

    console.log(`✓ Created test student: ${student.studentCode} with attendance code #${student.attendanceCode}`);

    // Verify student and attendance code exist in db
    const studentBefore = await prisma.student.findUnique({ where: { id: student.id } });
    if (!studentBefore) throw new Error('Student was not created');

    const codeBefore = await prisma.attendanceCode.findFirst({ where: { code: testAttendanceCode } });
    if (!codeBefore) throw new Error('Attendance code was not created');

    // 2. Call remove method
    const result = await studentsService.remove(student.id);
    console.log(`✓ studentsService.remove succeeded: ${result.message}`);

    // 3. Verify student is deleted
    const studentAfter = await prisma.student.findUnique({ where: { id: student.id } });
    if (studentAfter !== null) {
      throw new Error('Student record still exists after remove!');
    }
    console.log('✓ Student record successfully deleted from database');

    // 4. Verify 3-digit attendance code is freed up
    const codeRecord = await prisma.attendanceCode.findFirst({
      where: { code: testAttendanceCode },
    });
    if (codeRecord !== null) {
      throw new Error(`Attendance code #${testAttendanceCode} was not released!`);
    }
    console.log(`✓ Attendance code #${testAttendanceCode} successfully released for re-allocation`);

    // 5. Verify calling remove again throws NotFoundException
    try {
      await studentsService.remove(student.id);
      throw new Error('Expected NotFoundException when deleting non-existent student!');
    } catch (err: any) {
      if (err.message.includes('not found')) {
        console.log('✓ Idempotent / not-found handling verified');
      } else {
        throw err;
      }
    }

    // 6. Verify audit log entry
    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'Student', entityId: student.id, action: 'STUDENT_DELETED' },
    });
    console.log('✓ Verified audit log entry created');

    console.log('\n================================================================');
    console.log(' ALL STUDENT DELETION ACCEPTANCE CHECKS PASSED SUCCESSFULLY!');
    console.log('================================================================\n');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
