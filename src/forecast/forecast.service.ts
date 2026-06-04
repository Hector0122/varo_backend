import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ForecastResult {
  goalId: string;
  remainingAmount: number;
  avgMonthlySaving: number;
  estimatedDays: number;
  estimatedDate: Date;
  trend: 'up' | 'stable' | 'down';
  confidenceScore: number;
}

@Injectable()
export class ForecastService {
  constructor(private prisma: PrismaService) {}

  async computeForecast(goalId: string, userId: string): Promise<ForecastResult> {
    // 1. Verificar que la meta existe y pertenece al usuario
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, userId },
    });
    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    // 2. Agregar transacciones del usuario
    const [incomeAgg, expenseAgg] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { userId, type: 'INCOME' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { userId, type: 'EXPENSE' },
        _sum: { amount: true },
      }),
    ]);

    const totalIncome = Number(incomeAgg._sum.amount ?? 0);
    const totalExpense = Number(expenseAgg._sum.amount ?? 0);
    const monthlySaving = totalIncome - totalExpense;

    const targetAmount = Number(goal.targetAmount);
    const currentAmount = Number(goal.currentAmount);
    const remainingAmount = targetAmount - currentAmount;

    // Si ya se alcanzó la meta
    if (remainingAmount <= 0) {
      const snapshot = await this.prisma.forecastSnapshot.create({
        data: {
          goalId,
          projectedDate: new Date(),
          monthlySaving: 0,
          confidenceScore: 1,
        },
      });

      return {
        goalId,
        remainingAmount: 0,
        avgMonthlySaving: 0,
        estimatedDays: 0,
        estimatedDate: new Date(),
        trend: 'stable',
        confidenceScore: 1,
      };
    }

    if (monthlySaving <= 0) {
      throw new BadRequestException(
        'No se puede calcular el forecast porque tus gastos superan o igualan tus ingresos. Ajusta tus movimientos para generar ahorro.',
      );
    }

    // 3. Calcular meses y fecha estimada
    const months = remainingAmount / monthlySaving;
    const estimatedDays = Math.ceil(months * 30);
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + estimatedDays);

    // 4. Confidence score basado en volumen de transacciones
    const txCount = await this.prisma.transaction.count({ where: { userId } });
    let confidenceScore = 0.9;
    if (txCount < 5) confidenceScore = 0.2;
    else if (txCount < 15) confidenceScore = 0.5;
    else if (txCount < 30) confidenceScore = 0.7;

    // 5. Calcular trend comparando con snapshot anterior
    const lastSnapshot = await this.prisma.forecastSnapshot.findFirst({
      where: { goalId },
      orderBy: { createdAt: 'desc' },
    });

    let trend: 'up' | 'stable' | 'down' = 'stable';
    if (lastSnapshot) {
      const lastSaving = Number(lastSnapshot.monthlySaving);
      if (monthlySaving > lastSaving * 1.05) {
        trend = 'up';
      } else if (monthlySaving < lastSaving * 0.95) {
        trend = 'down';
      } else {
        trend = 'stable';
      }
    }

    // 6. Guardar snapshot
    await this.prisma.forecastSnapshot.create({
      data: {
        goalId,
        projectedDate: estimatedDate,
        monthlySaving,
        confidenceScore,
      },
    });

    return {
      goalId,
      remainingAmount,
      avgMonthlySaving: monthlySaving,
      estimatedDays,
      estimatedDate,
      trend,
      confidenceScore,
    };
  }

  async getSnapshots(goalId: string, userId: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, userId },
    });
    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    return this.prisma.forecastSnapshot.findMany({
      where: { goalId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
