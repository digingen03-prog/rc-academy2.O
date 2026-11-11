import { PrismaClient, UserRoleType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting RCA2.O Database Seeding (Admin User Only)...');

  // 1. Ensure Standard System Roles Exist
  const standardRoles = [
    { name: UserRoleType.SUPER_ADMIN, description: 'Universal system administrator and academy owner' },
    { name: UserRoleType.ACADEMY_ADMIN, description: 'Academy administrator with full operational access' },
    { name: UserRoleType.TEACHER, description: 'Teaching faculty member and course instructor' },
    { name: UserRoleType.ACCOUNTANT, description: 'Accountant managing student billing, fee receipts, and settlements' },
    { name: UserRoleType.STAFF, description: 'General staff member (administrative, support, reception)' },
  ];

  for (const roleDef of standardRoles) {
    await prisma.role.upsert({
      where: { name: roleDef.name },
      update: { description: roleDef.description },
      create: roleDef,
    });
  }

  const superAdminRole = await prisma.role.findUniqueOrThrow({
    where: { name: UserRoleType.SUPER_ADMIN },
  });

  // 2. Seed Default Admin User
  const passwordHash = await bcrypt.hash('Admin@RCA2026', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@rcacademy.com' },
    update: {
      passwordHash,
      status: 'ACTIVE',
    },
    create: {
      email: 'admin@rcacademy.com',
      passwordHash,
      firstName: 'RC',
      lastName: 'SuperAdmin',
      status: 'ACTIVE',
    },
  });

  // 3. Assign Super Admin Role to Admin User
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: superAdminRole.id,
    },
  });

  console.log(`✅ Default SuperAdmin created: admin@rcacademy.com (Password: Admin@RCA2026)`);
  console.log('🎉 Admin-only seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
