import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'hpave954@gmail.com';
  const password = '12345678';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('Usuario ya existe:', email);
    await prisma.$disconnect();
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      password: hashed,
    },
  });

  console.log('Usuario creado:', user.id, user.email);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
