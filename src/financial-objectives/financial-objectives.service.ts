import { Injectable, NotFoundException } from '@nestjs/common';
import { FinancialObjectiveType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export function objectiveEntrySign(
  objectiveType: FinancialObjectiveType,
  entryType: string,
): 1 | -1 {
  if (objectiveType === 'SAVING_GOAL') {
    return entryType === 'ADD' ? 1 : -1;
  }
  return entryType === 'INCREASE' ? 1 : -1;
}

export interface CreateObjectiveInput {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  savingAllocation?: number;
  dueDate?: Date | null;
  statementDay?: number;
}

export type UpdateObjectiveInput = Partial<CreateObjectiveInput>;

export interface ApplyEntryInput {
  objectiveId: string;
  userId: string;
  amount: number;
  entryType: string;
  note?: string;
  installments?: number;
  date?: Date;
  linkedTransaction?: {
    type: 'INCOME' | 'EXPENSE';
    category: string;
    note?: string;
  };
  incrementTargetAmount?: boolean;
}

@Injectable()
export class FinancialObjectivesService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string, type: FinancialObjectiveType) {
    return this.prisma.financialObjective.findMany({
      where: { userId, type },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(
    id: string,
    userId: string,
    type: FinancialObjectiveType,
    notFoundMessage: string,
  ) {
    const objective = await this.prisma.financialObjective.findFirst({
      where: { id, userId, type },
    });
    if (!objective) {
      throw new NotFoundException(notFoundMessage);
    }
    return objective;
  }

  create(
    userId: string,
    type: FinancialObjectiveType,
    data: CreateObjectiveInput,
  ) {
    return this.prisma.financialObjective.create({
      data: {
        userId,
        type,
        name: data.name,
        targetAmount: data.targetAmount,
        ...(data.currentAmount !== undefined && {
          currentAmount: data.currentAmount,
        }),
        ...(data.savingAllocation !== undefined && {
          savingAllocation: data.savingAllocation,
        }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
        ...(data.statementDay !== undefined && {
          statementDay: data.statementDay,
        }),
      },
    });
  }

  async update(
    id: string,
    userId: string,
    type: FinancialObjectiveType,
    notFoundMessage: string,
    data: UpdateObjectiveInput,
  ) {
    await this.findOne(id, userId, type, notFoundMessage);
    return this.prisma.financialObjective.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.targetAmount !== undefined && {
          targetAmount: data.targetAmount,
        }),
        ...(data.currentAmount !== undefined && {
          currentAmount: data.currentAmount,
        }),
        ...(data.savingAllocation !== undefined && {
          savingAllocation: data.savingAllocation,
        }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
        ...(data.statementDay !== undefined && {
          statementDay: data.statementDay,
        }),
      },
    });
  }

  async remove(
    id: string,
    userId: string,
    type: FinancialObjectiveType,
    notFoundMessage: string,
  ) {
    await this.findOne(id, userId, type, notFoundMessage);
    await this.prisma.objectiveForecastSnapshot.deleteMany({
      where: { objectiveId: id },
    });
    await this.prisma.objectiveEntry.deleteMany({
      where: { objectiveId: id },
    });
    return this.prisma.financialObjective.delete({ where: { id } });
  }

  async applyEntry(input: ApplyEntryInput) {
    const objective = await this.prisma.financialObjective.findFirst({
      where: { id: input.objectiveId, userId: input.userId },
    });
    if (!objective) {
      throw new NotFoundException('Financial objective not found');
    }

    const date = input.date ?? new Date();
    const sign = objectiveEntrySign(objective.type, input.entryType);
    const balanceDelta = sign * input.amount;

    return this.prisma.$transaction(async (tx) => {
      let transactionId: string | undefined;
      if (input.linkedTransaction) {
        const transaction = await tx.transaction.create({
          data: {
            userId: input.userId,
            amount: input.amount,
            type: input.linkedTransaction.type,
            category: input.linkedTransaction.category,
            note: input.linkedTransaction.note ?? null,
            date,
          },
        });
        transactionId = transaction.id;
      }

      await tx.objectiveEntry.create({
        data: {
          objectiveId: input.objectiveId,
          amount: input.amount,
          type: input.entryType,
          ...(input.note && { note: input.note }),
          ...(input.installments !== undefined && {
            installments: input.installments,
          }),
          purchaseDate: date,
          ...(transactionId && { transactionId }),
        },
      });

      return tx.financialObjective.update({
        where: { id: input.objectiveId },
        data: {
          currentAmount: { increment: balanceDelta },
          ...(input.incrementTargetAmount && {
            targetAmount: { increment: input.amount },
          }),
        },
      });
    });
  }

  getEntries(objectiveId: string, types: string[]) {
    return this.prisma.objectiveEntry.findMany({
      where: { objectiveId, type: { in: types } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
