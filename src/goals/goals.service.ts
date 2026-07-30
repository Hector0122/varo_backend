import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ForecastService } from '../forecast/forecast.service';
import { SYSTEM_CATEGORIES } from '../categories/system-categories.constant';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';

@Injectable()
export class GoalsService {
  constructor(
    private prisma: PrismaService,
    private forecastService: ForecastService,
  ) {}

  async findAll(userId: string) {
    return this.prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id, userId },
    });
    if (!goal) {
      throw new NotFoundException('Goal not found');
    }
    return goal;
  }

  async create(userId: string, dto: CreateGoalDto) {
    return this.prisma.goal.create({
      data: {
        userId,
        name: dto.name,
        targetAmount: dto.targetAmount,
        savingAllocation: dto.savingAllocation ?? 100,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateGoalDto) {
    await this.findOne(id, userId);

    return this.prisma.goal.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.targetAmount !== undefined && {
          targetAmount: dto.targetAmount,
        }),
        ...(dto.currentAmount !== undefined && {
          currentAmount: dto.currentAmount,
        }),
        ...(dto.savingAllocation !== undefined && {
          savingAllocation: dto.savingAllocation,
        }),
      },
    });
  }

  async addSavings(id: string, userId: string, amount: number) {
    const goal = await this.findOne(id, userId);

    const updatedGoal = await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId,
          amount,
          type: 'EXPENSE',
          category: SYSTEM_CATEGORIES.SAVINGS,
          note: `Ahorro: ${goal.name}`,
          date: new Date(),
        },
      });
      await tx.goalContribution.create({
        data: {
          goalId: id,
          amount,
          type: 'ADD',
          transactionId: transaction.id,
        },
      });
      return tx.goal.update({
        where: { id },
        data: { currentAmount: { increment: amount } },
      });
    });

    await this.forecastService.recalculateAllForUser(userId);
    return updatedGoal;
  }

  async withdrawSavings(id: string, userId: string, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('El monto a retirar debe ser mayor a 0');
    }
    const goal = await this.findOne(id, userId);
    if (Number(goal.currentAmount) < amount) {
      throw new BadRequestException('No hay suficiente ahorro para retirar');
    }

    const updatedGoal = await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId,
          amount,
          type: 'INCOME',
          category: SYSTEM_CATEGORIES.SAVINGS,
          note: `Retiro: ${goal.name}`,
          date: new Date(),
        },
      });
      await tx.goalContribution.create({
        data: {
          goalId: id,
          amount,
          type: 'WITHDRAW',
          transactionId: transaction.id,
        },
      });
      return tx.goal.update({
        where: { id },
        data: { currentAmount: { decrement: amount } },
      });
    });

    await this.forecastService.recalculateAllForUser(userId);
    return updatedGoal;
  }

  async getContributions(goalId: string, userId: string) {
    await this.findOne(goalId, userId);
    return this.prisma.goalContribution.findMany({
      where: { goalId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    await this.prisma.forecastSnapshot.deleteMany({ where: { goalId: id } });
    await this.prisma.goalContribution.deleteMany({ where: { goalId: id } });
    return this.prisma.goal.delete({ where: { id } });
  }
}
