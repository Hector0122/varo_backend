import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ForecastResult {
  goalId: string;
  goalName: string;
  remainingAmount: number;
  avgMonthlySaving: number;
  monthlyNeeded: number;
  estimatedDays: number;
  estimatedDate: Date;
  trend: 'up' | 'stable' | 'down';
  confidenceScore: number;
  savingAllocation: number;
  totalMonthlySaving: number;
}

export interface DebtForecastResult {
  debtId: string;
  debtName: string;
  remainingAmount: number;
  avgMonthlyPayment: number;
  estimatedDays: number;
  estimatedDate: Date;
  trend: 'up' | 'stable' | 'down';
  confidenceScore: number;
}

interface ProjectionInput {
  remainingAmount: number;
  effectiveRate: number;
  previousRate: number | null;
  dataPointCount: number;
}

interface Projection {
  estimatedDays: number;
  estimatedDate: Date;
  confidenceScore: number;
  trend: 'up' | 'stable' | 'down';
}

@Injectable()
export class ForecastService {
  constructor(private prisma: PrismaService) {}

  // Remaining/rate -> months -> estimated date, then confidence by data volume
  // and trend by comparison to the previous rate. Shared by Goal (ACCUMULATE)
  // and Debt (PAYDOWN) forecasts — only how remainingAmount/effectiveRate are
  // derived differs between the two.
  private calculateProjection(input: ProjectionInput): Projection {
    const months = input.remainingAmount / input.effectiveRate;
    const estimatedDays = Math.ceil(months * 30);
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + estimatedDays);

    let confidenceScore = 0.9;
    if (input.dataPointCount < 5) confidenceScore = 0.2;
    else if (input.dataPointCount < 15) confidenceScore = 0.5;
    else if (input.dataPointCount < 30) confidenceScore = 0.7;

    let trend: 'up' | 'stable' | 'down' = 'stable';
    if (input.previousRate !== null) {
      if (input.effectiveRate > input.previousRate * 1.05) {
        trend = 'up';
      } else if (input.effectiveRate < input.previousRate * 0.95) {
        trend = 'down';
      }
    }

    return { estimatedDays, estimatedDate, confidenceScore, trend };
  }

  async computeForecast(
    goalId: string,
    userId: string,
  ): Promise<ForecastResult> {
    const goal = await this.prisma.financialObjective.findFirst({
      where: { id: goalId, userId, type: 'SAVING_GOAL' },
    });
    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    const [incomeAgg, expenseAgg, oldestTx] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { userId, type: 'INCOME' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { userId, type: 'EXPENSE' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.findFirst({
        where: { userId },
        orderBy: { date: 'asc' },
        select: { date: true },
      }),
    ]);

    const totalIncome = Number(incomeAgg._sum.amount ?? 0);
    const totalExpense = Number(expenseAgg._sum.amount ?? 0);
    const netTotal = totalIncome - totalExpense;

    const monthsElapsed = oldestTx
      ? Math.max(
          1,
          (new Date().getTime() - new Date(oldestTx.date).getTime()) /
            (1000 * 60 * 60 * 24 * 30.44),
        )
      : 1;

    const monthlySaving = netTotal / monthsElapsed;

    const targetAmount = Number(goal.targetAmount);
    const currentAmount = Number(goal.currentAmount);
    const allocation = Number(goal.savingAllocation ?? 100) / 100;
    const effectiveMonthlySaving = monthlySaving * allocation;
    const remainingAmount = targetAmount - currentAmount;

    if (remainingAmount <= 0) {
      await this.prisma.objectiveForecastSnapshot.create({
        data: {
          objectiveId: goalId,
          projectedDate: new Date(),
          monthlyRate: 0,
          confidenceScore: 1,
        },
      });

      return {
        goalId,
        goalName: goal.name,
        remainingAmount: 0,
        avgMonthlySaving: 0,
        monthlyNeeded: 0,
        estimatedDays: 0,
        estimatedDate: new Date(),
        trend: 'stable',
        confidenceScore: 1,
        savingAllocation: Number(goal.savingAllocation ?? 100),
        totalMonthlySaving: monthlySaving,
      };
    }

    if (effectiveMonthlySaving <= 0) {
      throw new BadRequestException(
        'No se puede calcular el forecast porque tus gastos superan o igualan tus ingresos. Ajusta tus movimientos para generar ahorro.',
      );
    }

    const txCount = await this.prisma.transaction.count({ where: { userId } });

    const lastSnapshot = await this.prisma.objectiveForecastSnapshot.findFirst({
      where: { objectiveId: goalId },
      orderBy: { createdAt: 'desc' },
    });

    const projection = this.calculateProjection({
      remainingAmount,
      effectiveRate: effectiveMonthlySaving,
      previousRate: lastSnapshot ? Number(lastSnapshot.monthlyRate) : null,
      dataPointCount: txCount,
    });

    const monthlyNeeded = Math.ceil(effectiveMonthlySaving);

    await this.prisma.objectiveForecastSnapshot.create({
      data: {
        objectiveId: goalId,
        projectedDate: projection.estimatedDate,
        monthlyRate: effectiveMonthlySaving,
        confidenceScore: projection.confidenceScore,
      },
    });

    return {
      goalId,
      goalName: goal.name,
      remainingAmount,
      avgMonthlySaving: effectiveMonthlySaving,
      monthlyNeeded,
      estimatedDays: projection.estimatedDays,
      estimatedDate: projection.estimatedDate,
      trend: projection.trend,
      confidenceScore: projection.confidenceScore,
      savingAllocation: Number(goal.savingAllocation ?? 100),
      totalMonthlySaving: monthlySaving,
    };
  }

  async computeDebtForecast(
    debtId: string,
    userId: string,
  ): Promise<DebtForecastResult> {
    const debt = await this.prisma.financialObjective.findFirst({
      where: { id: debtId, userId, type: 'DEBT_PAYOFF' },
    });
    if (!debt) {
      throw new NotFoundException('Debt not found');
    }

    const remainingAmount = Number(debt.currentAmount);

    if (remainingAmount <= 0) {
      await this.prisma.objectiveForecastSnapshot.create({
        data: {
          objectiveId: debtId,
          projectedDate: new Date(),
          monthlyRate: 0,
          confidenceScore: 1,
        },
      });

      return {
        debtId,
        debtName: debt.name,
        remainingAmount: 0,
        avgMonthlyPayment: 0,
        estimatedDays: 0,
        estimatedDate: new Date(),
        trend: 'stable',
        confidenceScore: 1,
      };
    }

    const paymentAgg = await this.prisma.objectiveEntry.aggregate({
      where: { objectiveId: debtId, type: 'PAYMENT' },
      _sum: { amount: true },
      _count: true,
    });

    const totalPaid = Number(paymentAgg._sum.amount ?? 0);
    const paymentCount = paymentAgg._count;

    if (paymentCount === 0) {
      // No hay pagos aún: no se puede proyectar, pero no es un error.
      return {
        debtId,
        debtName: debt.name,
        remainingAmount,
        avgMonthlyPayment: 0,
        estimatedDays: 0,
        estimatedDate: new Date(),
        trend: 'stable',
        confidenceScore: 0,
      };
    }

    const monthsSinceCreated = Math.max(
      1,
      (new Date().getTime() - new Date(debt.createdAt).getTime()) /
        (1000 * 60 * 60 * 24 * 30.44),
    );
    const effectiveMonthlyPayment = totalPaid / monthsSinceCreated;

    const lastSnapshot = await this.prisma.objectiveForecastSnapshot.findFirst({
      where: { objectiveId: debtId },
      orderBy: { createdAt: 'desc' },
    });

    const projection = this.calculateProjection({
      remainingAmount,
      effectiveRate: effectiveMonthlyPayment,
      previousRate: lastSnapshot ? Number(lastSnapshot.monthlyRate) : null,
      dataPointCount: paymentCount,
    });

    await this.prisma.objectiveForecastSnapshot.create({
      data: {
        objectiveId: debtId,
        projectedDate: projection.estimatedDate,
        monthlyRate: effectiveMonthlyPayment,
        confidenceScore: projection.confidenceScore,
      },
    });

    return {
      debtId,
      debtName: debt.name,
      remainingAmount,
      avgMonthlyPayment: effectiveMonthlyPayment,
      estimatedDays: projection.estimatedDays,
      estimatedDate: projection.estimatedDate,
      trend: projection.trend,
      confidenceScore: projection.confidenceScore,
    };
  }

  async recalculateAllForUser(userId: string) {
    const objectives = await this.prisma.financialObjective.findMany({
      where: { userId },
    });
    for (const objective of objectives) {
      try {
        if (objective.type === 'SAVING_GOAL') {
          await this.computeForecast(objective.id, userId);
        } else {
          await this.computeDebtForecast(objective.id, userId);
        }
      } catch {
        // Ignorar objetivos que no pueden generar forecast (tasa <= 0)
      }
    }
  }
}
