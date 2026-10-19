import { PrismaClient, UserRoleType, Gender, SessionType, AttendanceStatus, InvoiceStatus, PaymentMethod, DifficultyLevel, QuestionType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting RCA2.O Database Seeding...');

  // 1. Seed Roles
  const roles = [
    { name: UserRoleType.SUPER_ADMIN, description: 'Universal system administrator and academy owner' },
    { name: UserRoleType.ACADEMY_ADMIN, description: 'Academy administrative manager' },
    { name: UserRoleType.TEACHER, description: 'Academic instructor with grading and review access' },
    { name: UserRoleType.ACCOUNTANT, description: 'Financial ledger and payment recording officer' },
    { name: UserRoleType.STAFF, description: 'General administrative staff' },
  ];

  const roleMap: Record<string, string> = {};
  for (const r of roles) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: {},
      create: { name: r.name, description: r.description },
    });
    roleMap[r.name] = role.id;
  }
  console.log('✅ Roles seeded');

  // 2. Seed Permissions
  const permissions = [
    { code: 'students.read', module: 'students', description: 'View student profiles' },
    { code: 'students.create', module: 'students', description: 'Create new student records' },
    { code: 'students.update', module: 'students', description: 'Edit student profiles' },
    { code: 'attendance.read', module: 'attendance', description: 'View attendance logs' },
    { code: 'attendance.mark', module: 'attendance', description: 'Record student attendance' },
    { code: 'fees.read', module: 'finance', description: 'View invoices and fee plans' },
    { code: 'payments.record', module: 'finance', description: 'Record student fee payments' },
    { code: 'examinations.read', module: 'academics', description: 'View exams and questions' },
    { code: 'examinations.create', module: 'academics', description: 'Create examinations and question banks' },
    { code: 'evaluations.review', module: 'ai-evaluation', description: 'Review AI evaluations' },
    { code: 'results.publish', module: 'academics', description: 'Authorize and publish results' },
    { code: 'dashboard.read', module: 'dashboard', description: 'View real-time academy metrics' },
  ];

  for (const p of permissions) {
    const perm = await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });

    // Grant all to SUPER_ADMIN & ACADEMY_ADMIN
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: roleMap[UserRoleType.SUPER_ADMIN], permissionId: perm.id } },
      update: {},
      create: { roleId: roleMap[UserRoleType.SUPER_ADMIN], permissionId: perm.id },
    });
  }
  console.log('✅ Permissions seeded');

  // 3. Seed Default Admin User
  const passwordHash = await bcrypt.hash('Admin@RCA2026', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@rcacademy.com' },
    update: {},
    create: {
      email: 'admin@rcacademy.com',
      passwordHash,
      firstName: 'RC',
      lastName: 'SuperAdmin',
      status: 'ACTIVE',
      userRoles: {
        create: [
          { roleId: roleMap[UserRoleType.SUPER_ADMIN] },
          { roleId: roleMap[UserRoleType.ACADEMY_ADMIN] },
        ],
      },
    },
  });
  console.log(`✅ Default SuperAdmin created: admin@rcacademy.com (Password: Admin@RCA2026)`);

  // 4. Seed Academic Year
  await prisma.academicYear.upsert({
    where: { name: '2026-2027' },
    update: { isCurrent: true },
    create: {
      name: '2026-2027',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2027-05-31'),
      isCurrent: true,
    },
  });

  console.log('✅ Base Academic Year (2026-2027) seeded');
  console.log('🎉 Clean seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
