import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ForecastService } from '../forecast/forecast.service';
import { CreateRecurringTransactionDto } from './dto/create-recurring-transaction.dto';
import { UpdateRecurringTransactionDto } from './dto/update-recurring-transaction.dto';

@Injectable()
export class RecurringTransactionsService {
  constructor(
    private prisma: PrismaService,
    private forecastService: ForecastService,
  ) {}

  async findAll(userId: string) {
    return this.prisma.recurringTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const rt = await this.prisma.recurringTransaction.findFirst({
      where: { id, userId },
    });
    if (!rt) throw new NotFoundException('Recurring transaction not found');
    return rt;
  }

  async create(userId: string, dto: CreateRecurringTransactionDto) {
    return this.prisma.recurringTransaction.create({
      data: {
        userId,
        amount: dto.amount,
        type: dto.type,
        category: dto.category,
        note: dto.note ?? null,
        frequency: dto.frequency,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateRecurringTransactionDto) {
    await this.findOne(id, userId);
    return this.prisma.recurringTransaction.update({
      where: { id },
      data: {
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.type && { type: dto.type }),
        ...(dto.category && { category: dto.category }),
        ...(dto.note !== undefined && { note: dto.note }),
        ...(dto.frequency && { frequency: dto.frequency }),
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate ? new Date(dto.endDate) : null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.recurringTransaction.delete({ where: { id } });
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processRecurringTransactions() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const recurring = await this.prisma.recurringTransaction.findMany({
      where: { isActive: true },
    });

    for (const rt of recurring) {
      const startDate = new Date(rt.startDate);
      const endDate = rt.endDate ? new Date(rt.endDate) : null;

      if (endDate && today > endDate) continue;
      if (today < startDate) continue;

      let shouldGenerate = false;
      const lastGenerated = rt.lastGeneratedAt
        ? new Date(rt.lastGeneratedAt)
        : null;

      if (!lastGenerated) {
        shouldGenerate = true;
      } else {
        const lastGenDate = new Date(
          lastGenerated.getFullYear(),
          lastGenerated.getMonth(),
          lastGenerated.getDate(),
        );
        const diffMs = today.getTime() - lastGenDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        switch (rt.frequency) {
          case 'DAILY':
            shouldGenerate = diffDays >= 1;
            break;
          case 'WEEKLY':
            shouldGenerate = diffDays >= 7;
            break;
          case 'BIWEEKLY':
            shouldGenerate = diffDays >= 14;
            break;
          case 'MONTHLY':
            shouldGenerate =
              today.getMonth() !== lastGenDate.getMonth() ||
              today.getFullYear() !== lastGenDate.getFullYear();
            break;
          case 'YEARLY':
            shouldGenerate = today.getFullYear() !== lastGenDate.getFullYear();
            break;
        }
      }

      if (shouldGenerate) {
        await this.prisma.transaction.create({
          data: {
            userId: rt.userId,
            amount: rt.amount,
            type: rt.type,
            category: rt.category,
            note: rt.note ? `${rt.note} (recurrente)` : 'Recurrente',
            date: today,
          },
        });

        await this.prisma.recurringTransaction.update({
          where: { id: rt.id },
          data: { lastGeneratedAt: today },
        });

        // Recalcular forecast
        const goals = await this.prisma.goal.findMany({
          where: { userId: rt.userId },
        });
        for (const goal of goals) {
          try {
            await this.forecastService.computeForecast(goal.id, rt.userId);
          } catch {
            // ignorar
          }
        }
      }
    }
  }
}
