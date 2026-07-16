import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';
import { MakePaymentDto } from './dto/make-payment.dto';
import { AddAmountDto } from './dto/add-amount.dto';
import {
  addCycles,
  getBillingCycleStart,
  getCurrentBillingPeriod,
} from './billing-cycle.util';

@Injectable()
export class DebtService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.debt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const debt = await this.prisma.debt.findFirst({ where: { id, userId } });
    if (!debt) throw new NotFoundException('Debt not found');
    return debt;
  }

  async create(userId: string, dto: CreateDebtDto) {
    return this.prisma.debt.create({
      data: {
        userId,
        name: dto.name,
        totalAmount: dto.totalAmount,
        currentAmount: dto.currentAmount ?? dto.totalAmount,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        ...(dto.statementDay !== undefined && {
          statementDay: dto.statementDay,
        }),
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateDebtDto) {
    await this.findOne(id, userId);
    return this.prisma.debt.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.totalAmount !== undefined && { totalAmount: dto.totalAmount }),
        ...(dto.currentAmount !== undefined && {
          currentAmount: dto.currentAmount,
        }),
        ...(dto.dueDate !== undefined && {
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        }),
        ...(dto.statementDay !== undefined && {
          statementDay: dto.statementDay,
        }),
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.debtPayment.deleteMany({ where: { debtId: id } });
    return this.prisma.debt.delete({ where: { id } });
  }

  async makePayment(id: string, userId: string, dto: MakePaymentDto) {
    const debt = await this.findOne(id, userId);
    if (Number(debt.currentAmount) < dto.amount) {
      throw new BadRequestException(
        'El pago no puede ser mayor al saldo pendiente',
      );
    }
    await this.prisma.debtPayment.create({
      data: {
        debtId: id,
        amount: dto.amount,
        type: 'PAYMENT',
        ...(dto.note && { note: dto.note }),
      },
    });
    return this.prisma.debt.update({
      where: { id },
      data: { currentAmount: { decrement: dto.amount } },
    });
  }

  async addAmount(id: string, userId: string, dto: AddAmountDto) {
    await this.findOne(id, userId);
    const installments = dto.installments ?? 1;
    const purchaseDate = new Date();
    await this.prisma.debtPayment.create({
      data: {
        debtId: id,
        amount: dto.amount,
        type: 'INCREASE',
        ...(dto.note && { note: dto.note }),
        installments,
        purchaseDate,
      },
    });
    return this.prisma.debt.update({
      where: { id },
      data: {
        currentAmount: { increment: dto.amount },
        totalAmount: { increment: dto.amount },
      },
    });
  }

  async getMonthlySpending(userId: string) {
    const debts = await this.prisma.debt.findMany({ where: { userId } });
    const now = new Date();

    const results: {
      debtId: string;
      monthlySpending: number;
      periodStart: Date;
      periodEnd: Date;
    }[] = [];

    for (const debt of debts) {
      const { periodStart, periodEnd } = getCurrentBillingPeriod(
        debt.statementDay,
        now,
      );

      const payments = await this.prisma.debtPayment.findMany({
        where: { debtId: debt.id, type: 'INCREASE' },
      });

      let monthlySpending = 0;

      for (const p of payments) {
        const installments = p.installments ?? 1;
        const purchaseDate = p.purchaseDate
          ? new Date(p.purchaseDate)
          : new Date(p.createdAt);
        const firstCycleStart = getBillingCycleStart(
          purchaseDate,
          debt.statementDay,
        );

        if (installments === 1) {
          if (firstCycleStart.getTime() === periodStart.getTime()) {
            monthlySpending += Number(p.amount);
          }
        } else {
          const portion = Number(p.amount) / installments;
          for (let m = 0; m < installments; m++) {
            const cycleStart = addCycles(firstCycleStart, m, debt.statementDay);
            if (cycleStart.getTime() === periodStart.getTime()) {
              monthlySpending += portion;
            }
          }
        }
      }

      // Round to avoid floating point issues
      results.push({
        debtId: debt.id,
        monthlySpending: Math.round(monthlySpending * 100) / 100,
        periodStart,
        periodEnd,
      });
    }

    return results;
  }

  async getPayments(debtId: string, userId: string) {
    await this.findOne(debtId, userId);
    return this.prisma.debtPayment.findMany({
      where: { debtId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
