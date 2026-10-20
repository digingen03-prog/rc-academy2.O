import { PrismaClient, UserRoleType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting RCA2.O Database Seeding (Admin User Only)...');

  // 1. Ensure Super Admin Role Exists
  const superAdminRole = await prisma.role.upsert({
    where: { name: UserRoleType.SUPER_ADMIN },
    update: {},
    create: {
      name: UserRoleType.SUPER_ADMIN,
      description: 'Universal system administrator and academy owner',
    },
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
