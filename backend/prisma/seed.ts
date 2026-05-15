import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (existing) {
    console.log(`Admin user "${username}" already exists, skipping seed.`);
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await prisma.adminUser.create({ data: { username, password: hash } });
  console.log(`Admin user "${username}" created.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
