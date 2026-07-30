import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  { name: 'Sueldo', type: 'INCOME' },
  { name: 'Freelance', type: 'INCOME' },
  { name: 'Inversiones', type: 'INCOME' },
  { name: 'Venta', type: 'INCOME' },
  { name: 'Comida', type: 'EXPENSE' },
  { name: 'Transporte', type: 'EXPENSE' },
  { name: 'Servicios', type: 'EXPENSE' },
  { name: 'Renta', type: 'EXPENSE' },
  { name: 'Salud', type: 'EXPENSE' },
  { name: 'Entretenimiento', type: 'EXPENSE' },
  { name: 'Ropa', type: 'EXPENSE' },
  { name: 'Otro', type: 'BOTH' },
];

async function main() {
  const email = 'hpave954@gmail.com';
  const password = '12345678';

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const hashed = await bcrypt.hash(password, 10);
    user = await prisma.user.create({
      data: { email, password: hashed },
    });
    console.log('Usuario creado:', user.id, user.email);
  } else {
    console.log('Usuario ya existe:', email);
  }

  const existingCategories = await prisma.category.count({
    where: { userId: user.id },
  });
  if (existingCategories === 0) {
    await prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((cat) => ({ ...cat, userId: user.id })),
    });
    console.log(`Categorías creadas: ${DEFAULT_CATEGORIES.length}`);
  } else {
    console.log(`Categorías ya existen: ${existingCategories}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
