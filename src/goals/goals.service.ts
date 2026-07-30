import { Injectable, BadRequestException } from '@nestjs/common';
import { ForecastService } from '../forecast/forecast.service';
import { FinancialObjectivesService } from '../financial-objectives/financial-objectives.service';
import { SYSTEM_CATEGORIES } from '../categories/system-categories.constant';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';

const NOT_FOUND = 'Goal not found';

interface ObjectiveLike {
  id: string;
  userId: string;
  name: string;
  targetAmount: unknown;
  currentAmount: unknown;
  savingAllocation: unknown;
  createdAt: Date;
}

interface EntryLike {
  id: string;
  objectiveId: string;
  amount: unknown;
  type: string;
  note: string | null;
  purchaseDate: Date;
  createdAt: Date;
}

@Injectable()
export class GoalsService {
  constructor(
    private objectives: FinancialObjectivesService,
    private forecastService: ForecastService,
  ) {}

  private toGoal(objective: ObjectiveLike) {
    return {
      id: objective.id,
      userId: objective.userId,
      name: objective.name,
      targetAmount: objective.targetAmount,
      currentAmount: objective.currentAmount,
      savingAllocation: objective.savingAllocation,
      createdAt: objective.createdAt,
    };
  }

  private toContribution(entry: EntryLike) {
    return {
      id: entry.id,
      goalId: entry.objectiveId,
      amount: entry.amount,
      type: entry.type,
      note: entry.note,
      date: entry.purchaseDate,
      createdAt: entry.createdAt,
    };
  }

  async findAll(userId: string) {
    const objectives = await this.objectives.findAll(userId, 'SAVING_GOAL');
    return objectives.map((o) => this.toGoal(o));
  }

  async findOne(id: string, userId: string) {
    const objective = await this.objectives.findOne(
      id,
      userId,
      'SAVING_GOAL',
      NOT_FOUND,
    );
    return this.toGoal(objective);
  }

  async create(userId: string, dto: CreateGoalDto) {
    const objective = await this.objectives.create(userId, 'SAVING_GOAL', {
      name: dto.name,
      targetAmount: dto.targetAmount,
      savingAllocation: dto.savingAllocation ?? 100,
    });
    return this.toGoal(objective);
  }

  async update(id: string, userId: string, dto: UpdateGoalDto) {
    const objective = await this.objectives.update(
      id,
      userId,
      'SAVING_GOAL',
      NOT_FOUND,
      {
        name: dto.name,
        targetAmount: dto.targetAmount,
        currentAmount: dto.currentAmount,
        savingAllocation: dto.savingAllocation,
      },
    );
    return this.toGoal(objective);
  }

  async addSavings(id: string, userId: string, amount: number) {
    const goal = await this.objectives.findOne(
      id,
      userId,
      'SAVING_GOAL',
      NOT_FOUND,
    );

    const updated = await this.objectives.applyEntry({
      objectiveId: id,
      userId,
      amount,
      entryType: 'ADD',
      linkedTransaction: {
        type: 'EXPENSE',
        category: SYSTEM_CATEGORIES.SAVINGS,
        note: `Ahorro: ${goal.name}`,
      },
    });

    await this.forecastService.recalculateAllForUser(userId);
    return this.toGoal(updated);
  }

  async withdrawSavings(id: string, userId: string, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('El monto a retirar debe ser mayor a 0');
    }
    const goal = await this.objectives.findOne(
      id,
      userId,
      'SAVING_GOAL',
      NOT_FOUND,
    );
    if (Number(goal.currentAmount) < amount) {
      throw new BadRequestException('No hay suficiente ahorro para retirar');
    }

    const updated = await this.objectives.applyEntry({
      objectiveId: id,
      userId,
      amount,
      entryType: 'WITHDRAW',
      linkedTransaction: {
        type: 'INCOME',
        category: SYSTEM_CATEGORIES.SAVINGS,
        note: `Retiro: ${goal.name}`,
      },
    });

    await this.forecastService.recalculateAllForUser(userId);
    return this.toGoal(updated);
  }

  async getContributions(goalId: string, userId: string) {
    await this.objectives.findOne(goalId, userId, 'SAVING_GOAL', NOT_FOUND);
    const entries = await this.objectives.getEntries(goalId, [
      'ADD',
      'WITHDRAW',
    ]);
    return entries.map((e) => this.toContribution(e));
  }

  async remove(id: string, userId: string) {
    const objective = await this.objectives.remove(
      id,
      userId,
      'SAVING_GOAL',
      NOT_FOUND,
    );
    return this.toGoal(objective);
  }
}
