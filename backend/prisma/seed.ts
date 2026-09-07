import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (existing) {
    // Ensure the designated admin account always has admin role.
    // This handles the case where the role field was added via migration after
    // the user was already created (migration default is "user").
    if (existing.role !== 'admin') {
      await prisma.adminUser.update({ where: { username }, data: { role: 'admin' } });
      console.log(`Admin user "${username}" role upgraded to admin.`);
    } else {
      console.log(`Admin user "${username}" already exists with admin role, skipping.`);
    }
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await prisma.adminUser.create({
    data: { username, password: hash, role: 'admin', mustChangePassword: false },
  });
  console.log(`Admin user "${username}" created.`);

  // Initialize system settings
  await prisma.systemSetting.upsert({
    where: { key: 'allow_registration' },
    update: {},
    create: { key: 'allow_registration', value: 'false' },
  });
  console.log('System setting "allow_registration" initialized (default: false).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
