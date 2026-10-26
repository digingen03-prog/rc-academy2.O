import { ForbiddenException } from '@nestjs/common';
import { StudentsService } from './students.service';
import { DashboardService } from '../dashboard/dashboard.service';

describe('Staff Assigned Students & Dashboard Scoping Regression Suite', () => {
  let studentsService: StudentsService;
  let dashboardService: DashboardService;
  let mockPrisma: any;
  let mockAttendanceCodeService: any;
  let mockFeesService: any;

  const staffUser = {
    id: 'staff-user-uuid-1',
    roles: ['STAFF'],
    email: 'staff1@rcacademy.com',
  };

  const teacherUser = {
    id: 'teacher-user-uuid-2',
    roles: ['TEACHER'],
    email: 'teacher2@rcacademy.com',
  };

  const adminUser = {
    id: 'admin-user-uuid-3',
    roles: ['SUPER_ADMIN'],
    email: 'superadmin@rcacademy.com',
  };

  const academyAdminUser = {
    id: 'academy-admin-uuid-4',
    roles: ['ACADEMY_ADMIN'],
    email: 'academyadmin@rcacademy.com',
  };

  const mockBaseStudent = {
    id: 'student-assigned-1',
    studentCode: 'STU-001',
    admissionNumber: 'ADM-001',
    attendanceCode: '101',
    firstName: 'Aravind',
    lastName: 'Kumar',
    fullName: 'Aravind Kumar',
    schoolName: 'St Joseph School',
    dob: new Date('2008-01-01'),
    gender: 'MALE',
    email: 'aravind@example.com',
    phone: '9876543210',
    status: 'ACTIVE',
    batchEnrollments: [
      {
        id: 'en-1',
        studentId: 'student-assigned-1',
        batchId: 'batch-101',
        subjectId: 'subject-201',
        status: 'ACTIVE',
        isActive: true,
        batch: { id: 'batch-101', name: 'Batch A', code: 'BA', classId: 'class-1', class: { id: 'class-1', name: '10th', code: '10' } },
        subject: { id: 'subject-201', name: 'Physics', code: 'PHY' },
      },
    ],
    guardians: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'student-123' }]),
      student: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      staffCourseAssignment: {
        findMany: jest.fn(),
      },
      classSchedule: {
        findMany: jest.fn(),
      },
      studentBatchEnrollment: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      studentAdvance: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      feeInvoice: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { balanceAmount: 8000 },
          _count: 2,
        }),
      },
      batch: {
        count: jest.fn().mockResolvedValue(4),
      },
      class: {
        count: jest.fn().mockResolvedValue(2),
      },
      attendanceRecord: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(10),
      },
      examination: {
        count: jest.fn().mockResolvedValue(3),
      },
      studentSubmission: {
        count: jest.fn().mockResolvedValue(8),
      },
      user: {
        count: jest.fn().mockResolvedValue(5),
      },
    };

    mockAttendanceCodeService = {
      allocateCode: jest.fn().mockResolvedValue('101'),
    };

    mockFeesService = {
      createCourseInvoiceForEnrollment: jest.fn().mockResolvedValue({ id: 'inv-123' }),
    };

    studentsService = new StudentsService(
      mockPrisma,
      mockAttendanceCodeService,
      mockFeesService,
    );

    dashboardService = new DashboardService(mockPrisma);
  });

  describe('1. StudentsService.findAll - Staff Data Isolation', () => {
    it('should inject assigned condition filtering only students in staff courses/batches', async () => {
      mockPrisma.staffCourseAssignment.findMany.mockResolvedValue([
        { batchId: 'batch-101', subjectId: 'subject-201', classId: null },
      ]);
      mockPrisma.classSchedule.findMany.mockResolvedValue([]);

      mockPrisma.student.findMany.mockResolvedValue([mockBaseStudent]);
      mockPrisma.student.count.mockResolvedValue(1);

      const result = await studentsService.findAll({ page: 1, limit: 10 }, staffUser);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('student-assigned-1');
      expect(result.meta.total).toBe(1);

      // Verify that prisma.staffCourseAssignment.findMany was called with isActive: true
      expect(mockPrisma.staffCourseAssignment.findMany).toHaveBeenCalledWith({
        where: { userId: staffUser.id, isActive: true },
        select: { batchId: true, subjectId: true, classId: true },
      });

      const findManyCall = mockPrisma.student.findMany.mock.calls[0][0];
      expect(findManyCall.where.AND).toBeDefined();
    });

    it('should return empty result if staff has no assigned courses or batches', async () => {
      mockPrisma.staffCourseAssignment.findMany.mockResolvedValue([]);
      mockPrisma.classSchedule.findMany.mockResolvedValue([]);

      mockPrisma.student.findMany.mockResolvedValue([]);
      mockPrisma.student.count.mockResolvedValue(0);

      const result = await studentsService.findAll({ page: 1, limit: 10 }, staffUser);

      expect(result.items).toHaveLength(0);
      expect(result.meta.total).toBe(0);

      const findManyCall = mockPrisma.student.findMany.mock.calls[0][0];
      // Condition must be set to __NO_ASSIGNED_STUDENTS__
      expect(findManyCall.where.AND).toContainEqual({ id: '__NO_ASSIGNED_STUDENTS__' });
    });

    it('should NOT apply assigned scoping for SUPER_ADMIN or ACADEMY_ADMIN', async () => {
      mockPrisma.student.findMany.mockResolvedValue([
        { ...mockBaseStudent, id: 's1' },
        { ...mockBaseStudent, id: 's2' },
      ]);
      mockPrisma.student.count.mockResolvedValue(2);

      const result = await studentsService.findAll({ page: 1, limit: 10 }, adminUser);

      expect(mockPrisma.staffCourseAssignment.findMany).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(2);
    });
  });

  describe('2. StudentsService.findOne - Staff Access Control', () => {
    it('should throw ForbiddenException when staff attempts to access an unassigned student', async () => {
      mockPrisma.staffCourseAssignment.findMany.mockResolvedValue([
        { batchId: 'batch-A', subjectId: null, classId: null },
      ]);
      mockPrisma.classSchedule.findMany.mockResolvedValue([]);

      // Student is NOT assigned to this staff
      mockPrisma.student.findFirst.mockResolvedValue(null);

      await expect(
        studentsService.findOne('student-unassigned-99', staffUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow staff to access assigned student details', async () => {
      mockPrisma.staffCourseAssignment.findMany.mockResolvedValue([
        { batchId: 'batch-101', subjectId: 'subject-201', classId: null },
      ]);
      mockPrisma.classSchedule.findMany.mockResolvedValue([]);

      // Student verification passes
      mockPrisma.student.findFirst.mockResolvedValue({ id: 'student-assigned-1' });
      mockPrisma.student.findUnique.mockResolvedValue(mockBaseStudent);

      const res = await studentsService.findOne('student-assigned-1', staffUser);
      expect(res.id).toBe('student-assigned-1');
    });

    it('should allow SUPER_ADMIN to access any student without assignment checks', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({
        ...mockBaseStudent,
        id: 'student-unassigned-99',
        fullName: 'Any Student',
      });

      const res = await studentsService.findOne('student-unassigned-99', adminUser);
      expect(res.id).toBe('student-unassigned-99');
      expect(mockPrisma.staffCourseAssignment.findMany).not.toHaveBeenCalled();
    });
  });

  describe('3. StudentsService.getStudentEnrollments - Staff Verification', () => {
    it('should reject unassigned student enrollments lookup for staff', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({ id: 's-99', fullName: 'Student 99' });
      mockPrisma.staffCourseAssignment.findMany.mockResolvedValue([]);
      mockPrisma.classSchedule.findMany.mockResolvedValue([]);

      await expect(
        studentsService.getStudentEnrollments('s-99', staffUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('4. DashboardService.getMetrics - Scoped Role Metrics & Financial Protection', () => {
    it('should hide financial metrics (finance: null) and scope students to staff assignments', async () => {
      mockPrisma.staffCourseAssignment.findMany.mockResolvedValue([
        { batchId: 'batch-101', subjectId: null, classId: 'class-1' },
      ]);
      mockPrisma.classSchedule.findMany.mockResolvedValue([]);

      mockPrisma.student.count.mockResolvedValue(12);

      const metrics = await dashboardService.getMetrics(staffUser);

      // Finance dues must be strictly null (not leaked to staff)
      expect(metrics.finance).toBeNull();

      // Active students should be strictly scoped
      expect(metrics.activeStudents).toBe(12);

      // Assigned stats must be populated
      expect(metrics.assignedStats).toBeDefined();
      expect(metrics.assignedStats!.assignedCoursesCount).toBe(1);
    });

    it('should return full academy metrics including finance for SUPER_ADMIN', async () => {
      mockPrisma.student.count.mockResolvedValue(150);

      const metrics = await dashboardService.getMetrics(adminUser);

      expect(metrics.finance).toBeDefined();
      expect(metrics.finance!.totalOutstanding).toBe(8000);
      expect(metrics.activeStudents).toBe(150);
    });
  });
});
