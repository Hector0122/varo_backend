import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(email: string, password: string) {
    return this.prisma.user.create({
      data: { email, password },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /** Deja la cuenta en ceros: borra todo menos el usuario y su login. */
  async deleteAllData(userId: string) {
    const objective = { objective: { userId } };
    await this.prisma.$transaction([
      this.prisma.objectiveEntry.deleteMany({ where: objective }),
      this.prisma.objectiveForecastSnapshot.deleteMany({ where: objective }),
      this.prisma.financialObjective.deleteMany({ where: { userId } }),
      this.prisma.transaction.deleteMany({ where: { userId } }),
      this.prisma.recurringTransaction.deleteMany({ where: { userId } }),
      this.prisma.category.deleteMany({ where: { userId } }),
    ]);
    return { ok: true };
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
