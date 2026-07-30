import { Injectable, BadRequestException } from '@nestjs/common';
import { ForecastService } from '../forecast/forecast.service';
import { FinancialObjectivesService } from '../financial-objectives/financial-objectives.service';
import { SYSTEM_CATEGORIES } from '../categories/system-categories.constant';
import { parseDateInput } from '../common/date.util';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';
import { MakePaymentDto } from './dto/make-payment.dto';
import { AddAmountDto } from './dto/add-amount.dto';
import {
  addCycles,
  getBillingCycleStart,
  getCurrentBillingPeriod,
} from './billing-cycle.util';

const NOT_FOUND = 'Debt not found';

interface ObjectiveLike {
  id: string;
  userId: string;
  name: string;
  targetAmount: unknown;
  currentAmount: unknown;
  dueDate: Date | null;
  statementDay: number | null;
  createdAt: Date;
}

interface EntryLike {
  id: string;
  objectiveId: string;
  amount: unknown;
  type: string;
  note: string | null;
  installments: number;
  purchaseDate: Date;
  createdAt: Date;
}

@Injectable()
export class DebtService {
  constructor(
    private objectives: FinancialObjectivesService,
    private forecastService: ForecastService,
  ) {}

  private toDebt(objective: ObjectiveLike) {
    return {
      id: objective.id,
      userId: objective.userId,
      name: objective.name,
      totalAmount: objective.targetAmount,
      currentAmount: objective.currentAmount,
      dueDate: objective.dueDate,
      statementDay: objective.statementDay,
      createdAt: objective.createdAt,
    };
  }

  private toPayment(entry: EntryLike) {
    return {
      id: entry.id,
      debtId: entry.objectiveId,
      amount: entry.amount,
      type: entry.type,
      note: entry.note,
      installments: entry.installments,
      purchaseDate: entry.purchaseDate,
      createdAt: entry.createdAt,
    };
  }

  async findAll(userId: string) {
    const objectives = await this.objectives.findAll(userId, 'DEBT_PAYOFF');
    return objectives.map((o) => this.toDebt(o));
  }

  async findOne(id: string, userId: string) {
    const objective = await this.objectives.findOne(
      id,
      userId,
      'DEBT_PAYOFF',
      NOT_FOUND,
    );
    return this.toDebt(objective);
  }

  async create(userId: string, dto: CreateDebtDto) {
    const objective = await this.objectives.create(userId, 'DEBT_PAYOFF', {
      name: dto.name,
      targetAmount: dto.totalAmount,
      currentAmount: dto.currentAmount ?? dto.totalAmount,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      statementDay: dto.statementDay ?? 1,
    });
    return this.toDebt(objective);
  }

  async update(id: string, userId: string, dto: UpdateDebtDto) {
    const objective = await this.objectives.update(
      id,
      userId,
      'DEBT_PAYOFF',
      NOT_FOUND,
      {
        name: dto.name,
        targetAmount: dto.totalAmount,
        currentAmount: dto.currentAmount,
        ...(dto.dueDate !== undefined && {
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        }),
        statementDay: dto.statementDay,
      },
    );
    return this.toDebt(objective);
  }

  async remove(id: string, userId: string) {
    const objective = await this.objectives.remove(
      id,
      userId,
      'DEBT_PAYOFF',
      NOT_FOUND,
    );
    return this.toDebt(objective);
  }

  async makePayment(id: string, userId: string, dto: MakePaymentDto) {
    const debt = await this.objectives.findOne(
      id,
      userId,
      'DEBT_PAYOFF',
      NOT_FOUND,
    );
    if (Number(debt.currentAmount) < dto.amount) {
      throw new BadRequestException(
        'El pago no puede ser mayor al saldo pendiente',
      );
    }

    const date = dto.date ? parseDateInput(dto.date) : new Date();

    const updated = await this.objectives.applyEntry({
      objectiveId: id,
      userId,
      amount: dto.amount,
      entryType: 'PAYMENT',
      note: dto.note,
      date,
      linkedTransaction: {
        type: 'EXPENSE',
        category: SYSTEM_CATEGORIES.DEBT_PAYMENT,
        note: dto.note ?? `Pago: ${debt.name}`,
      },
    });

    await this.forecastService.recalculateAllForUser(userId);
    return this.toDebt(updated);
  }

  async addAmount(id: string, userId: string, dto: AddAmountDto) {
    await this.objectives.findOne(id, userId, 'DEBT_PAYOFF', NOT_FOUND);
    const purchaseDate = dto.date ? parseDateInput(dto.date) : new Date();

    const updated = await this.objectives.applyEntry({
      objectiveId: id,
      userId,
      amount: dto.amount,
      entryType: 'INCREASE',
      note: dto.note,
      installments: dto.installments ?? 1,
      date: purchaseDate,
      incrementTargetAmount: true,
    });

    return this.toDebt(updated);
  }

  async getMonthlySpending(userId: string) {
    const debts = await this.objectives.findAll(userId, 'DEBT_PAYOFF');
    const now = new Date();

    const results: {
      debtId: string;
      monthlySpending: number;
      periodStart: Date;
      periodEnd: Date;
    }[] = [];

    for (const debt of debts) {
      const statementDay = debt.statementDay ?? 1;
      const { periodStart, periodEnd } = getCurrentBillingPeriod(
        statementDay,
        now,
      );

      const payments = await this.objectives.getEntries(debt.id, ['INCREASE']);

      let monthlySpending = 0;

      for (const p of payments) {
        const installments = p.installments ?? 1;
        const purchaseDate = p.purchaseDate
          ? new Date(p.purchaseDate)
          : new Date(p.createdAt);
        const firstCycleStart = getBillingCycleStart(
          purchaseDate,
          statementDay,
        );

        if (installments === 1) {
          if (firstCycleStart.getTime() === periodStart.getTime()) {
            monthlySpending += Number(p.amount);
          }
        } else {
          const portion = Number(p.amount) / installments;
          for (let m = 0; m < installments; m++) {
            const cycleStart = addCycles(firstCycleStart, m, statementDay);
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
    await this.objectives.findOne(debtId, userId, 'DEBT_PAYOFF', NOT_FOUND);
    const entries = await this.objectives.getEntries(debtId, [
      'PAYMENT',
      'INCREASE',
    ]);
    return entries.map((e) => this.toPayment(e));
  }

  async getForecast(id: string, userId: string) {
    await this.objectives.findOne(id, userId, 'DEBT_PAYOFF', NOT_FOUND);
    return this.forecastService.computeDebtForecast(id, userId);
  }
}
