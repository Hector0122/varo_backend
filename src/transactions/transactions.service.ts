import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ForecastService } from '../forecast/forecast.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private forecastService: ForecastService,
  ) {}

  private async recalculateForecasts(userId: string) {
    const goals = await this.prisma.goal.findMany({ where: { userId } });
    for (const goal of goals) {
      try {
        await this.forecastService.computeForecast(goal.id, userId);
      } catch {
        // Ignorar metas que no pueden generar forecast (ahorro <= 0)
      }
    }
  }

  async findAll(userId: string, type?: string, category?: string) {
    const where: any = { userId };
    if (type) where.type = type;
    if (category) where.category = category;

    return this.prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return transaction;
  }

  async create(userId: string, dto: CreateTransactionDto) {
    const tx = await this.prisma.transaction.create({
      data: {
        userId,
        amount: dto.amount,
        type: dto.type,
        category: dto.category,
        note: dto.note ?? null,
        date: new Date(dto.date),
      },
    });
    await this.recalculateForecasts(userId);
    return tx;
  }

  async update(id: string, userId: string, dto: UpdateTransactionDto) {
    await this.findOne(id, userId);

    const tx = await this.prisma.transaction.update({
      where: { id },
      data: {
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.type && { type: dto.type }),
        ...(dto.category && { category: dto.category }),
        ...(dto.note !== undefined && { note: dto.note }),
        ...(dto.date && { date: new Date(dto.date) }),
      },
    });
    await this.recalculateForecasts(userId);
    return tx;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    const tx = await this.prisma.transaction.delete({ where: { id } });
    await this.recalculateForecasts(userId);
    return tx;
  }
}
