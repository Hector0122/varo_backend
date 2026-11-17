import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ForecastService } from '../forecast/forecast.service';
import { CreateRecurringTransactionDto } from './dto/create-recurring-transaction.dto';
import { UpdateRecurringTransactionDto } from './dto/update-recurring-transaction.dto';
import { Frequency, latestOccurrence, utcDay } from './occurrence.util';

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
        ...(dto.endDate !== undefined && {
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.recurringTransaction.delete({ where: { id } });
  }

  /**
   * Cada día registra los fijos cuya fecha más reciente (según su frecuencia y
   * su día de inicio) aún no se generó.
   * ponytail: si el servidor estuvo caído varios periodos solo genera el último.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processRecurringTransactions() {
    const today = utcDay(new Date());
    const recurring = await this.prisma.recurringTransaction.findMany({
      where: { isActive: true },
    });

    for (const rt of recurring) {
      const due = latestOccurrence(
        rt.startDate,
        rt.frequency as Frequency,
        today,
      );
      if (!due) continue;
      if (rt.endDate && due > rt.endDate) continue;
      if (rt.lastGeneratedAt && utcDay(rt.lastGeneratedAt) >= due) continue;

      await this.prisma.transaction.create({
        data: {
          userId: rt.userId,
          amount: rt.amount,
          type: rt.type,
          category: rt.category,
          note: rt.note ? `${rt.note} (recurrente)` : 'Recurrente',
          date: due,
        },
      });
      await this.prisma.recurringTransaction.update({
        where: { id: rt.id },
        data: { lastGeneratedAt: due },
      });
      await this.forecastService.recalculateAllForUser(rt.userId);
    }
  }
}
