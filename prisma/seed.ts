import { PrismaClient } from '@prisma/client';
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      email: 'admin@example.com',
      role: 'admin',
      permissions: {
        create: {
          viewOnly: true,
          createProcedureLog: true,
          editProcedureLog: true,
          editSettings: true,
          manageUsers: true,
        },
      },
    },
  });

  // Create regular user
  const userPassword = await bcrypt.hash('user123', 10);
  await prisma.user.upsert({
    where: { username: 'user' },
    update: {},
    create: {
      username: 'user',
      password: userPassword,
      email: 'user@example.com',
      role: 'user',
      permissions: {
        create: {
          viewOnly: true,
          createProcedureLog: false,
          editProcedureLog: false,
          editSettings: false,
          manageUsers: false,
        },
      },
    },
  });

  console.log('Seeded admin and user');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect()); 