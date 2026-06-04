import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

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
    return this.prisma.transaction.create({
      data: {
        userId,
        amount: dto.amount,
        type: dto.type,
        category: dto.category,
        note: dto.note ?? null,
        date: new Date(dto.date),
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateTransactionDto) {
    await this.findOne(id, userId);

    return this.prisma.transaction.update({
      where: { id },
      data: {
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.type && { type: dto.type }),
        ...(dto.category && { category: dto.category }),
        ...(dto.note !== undefined && { note: dto.note }),
        ...(dto.date && { date: new Date(dto.date) }),
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    return this.prisma.transaction.delete({ where: { id } });
  }
}
