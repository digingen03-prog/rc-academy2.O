import { PrismaClient, UserRoleType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Database Wipe & Reset (Admin User Only)...');

  // 1. Fetch all public tables except migrations
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations';
  `;

  console.log(`Found ${tables.length} tables in database:`);
  console.log(tables.map((t) => t.tablename).join(', '));

  // 2. Truncate all tables with CASCADE
  console.log('\n🗑️ Truncating all tables with CASCADE...');
  for (const { tablename } of tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" RESTART IDENTITY CASCADE;`);
      console.log(`  ✓ Truncated: ${tablename}`);
    } catch (err: any) {
      console.warn(`  ⚠️ Could not truncate ${tablename}: ${err.message}`);
    }
  }

  // 3. Seed Super Admin Role & Academy Admin Role
  console.log('\n👑 Seeding Admin Roles...');
  const superAdminRole = await prisma.role.create({
    data: {
      name: UserRoleType.SUPER_ADMIN,
      description: 'Universal system administrator and academy owner',
    },
  });

  const academyAdminRole = await prisma.role.create({
    data: {
      name: UserRoleType.ACADEMY_ADMIN,
      description: 'Academy administrator with full operational access',
    },
  });

  // 4. Create the Default Admin User
  console.log('👤 Creating Clean Admin User: admin@rcacademy.com...');
  const passwordHash = await bcrypt.hash('Admin@RCA2026', 10);
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@rcacademy.com',
      passwordHash,
      firstName: 'RC',
      lastName: 'SuperAdmin',
      status: 'ACTIVE',
    },
  });

  // 5. Assign Roles to Admin User
  await prisma.userRole.createMany({
    data: [
      { userId: adminUser.id, roleId: superAdminRole.id },
      { userId: adminUser.id, roleId: academyAdminRole.id },
    ],
  });

  // 6. Ensure default AcademySalaryConfig exists
  console.log('⚙️ Initializing Default Academy Salary Config...');
  await prisma.academySalaryConfig.create({
    data: {
      defaultStaffPoolRate: 70.0,
      defaultAcademyShareRate: 30.0,
      isApprovalRequired: false,
      fixedSalaryAutoAccrue: true,
      payDayOfMonth: 1,
    },
  });

  console.log('\n=== VERIFICATION ===');
  const userCount = await prisma.user.count();
  const studentCount = await prisma.student.count();
  const classCount = await prisma.class.count();
  const invoiceCount = await prisma.feeInvoice.count();
  const paymentCount = await prisma.payment.count();
  const ledgerCount = await prisma.staffSalaryLedger.count();
  const assignmentCount = await prisma.staffCourseAssignment.count();

  console.log(`- Remaining Users: ${userCount} (admin@rcacademy.com)`);
  console.log(`- Students: ${studentCount}`);
  console.log(`- Classes/Courses: ${classCount}`);
  console.log(`- Invoices: ${invoiceCount}`);
  console.log(`- Payments: ${paymentCount}`);
  console.log(`- Salary Ledgers: ${ledgerCount}`);
  console.log(`- Staff Assignments: ${assignmentCount}`);

  console.log('\n🎉 Database reset complete! ONLY the Admin user remains in the database.');
}

main()
  .catch((err) => {
    console.error('❌ Failed to wipe and reset database:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
