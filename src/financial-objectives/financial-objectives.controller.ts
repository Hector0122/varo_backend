import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FinancialObjectiveType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequestWithUser } from '../types/request-with-user';
import { ForecastService } from '../forecast/forecast.service';
import { SYSTEM_CATEGORIES } from '../categories/system-categories.constant';
import { parseDateInput } from '../common/date.util';
import { FinancialObjectivesService } from './financial-objectives.service';
import { CreateFinancialObjectiveDto } from './dto/create-financial-objective.dto';
import { UpdateFinancialObjectiveDto } from './dto/update-financial-objective.dto';
import {
  CreateObjectiveEntryDto,
  ObjectiveEntryType,
} from './dto/create-objective-entry.dto';

const NOT_FOUND = 'Financial objective not found';
const ALL_ENTRY_TYPES: ObjectiveEntryType[] = [
  'ADD',
  'WITHDRAW',
  'PAYMENT',
  'INCREASE',
];
const ALLOWED_ENTRY_TYPES: Record<
  FinancialObjectiveType,
  ObjectiveEntryType[]
> = {
  SAVING_GOAL: ['ADD', 'WITHDRAW'],
  DEBT_PAYOFF: ['PAYMENT', 'INCREASE'],
};

@UseGuards(JwtAuthGuard)
@Controller('objectives')
export class FinancialObjectivesController {
  constructor(
    private objectives: FinancialObjectivesService,
    private forecastService: ForecastService,
  ) {}

  @Get()
  findAll(
    @Req() req: RequestWithUser,
    @Query('type') type?: FinancialObjectiveType,
  ) {
    return this.objectives.findAllAny(req.user.id, type);
  }

  @Get(':id')
  findOne(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.objectives.findOneAny(id, req.user.id);
  }

  @Post()
  create(
    @Req() req: RequestWithUser,
    @Body() dto: CreateFinancialObjectiveDto,
  ) {
    return this.objectives.create(req.user.id, dto.type, {
      name: dto.name,
      targetAmount: dto.targetAmount,
      savingAllocation: dto.savingAllocation,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      statementDay: dto.statementDay,
    });
  }

  @Patch(':id')
  async update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateFinancialObjectiveDto,
  ) {
    const objective = await this.objectives.findOneAny(id, req.user.id);
    return this.objectives.update(id, req.user.id, objective.type, NOT_FOUND, {
      name: dto.name,
      targetAmount: dto.targetAmount,
      currentAmount: dto.currentAmount,
      savingAllocation: dto.savingAllocation,
      ...(dto.dueDate !== undefined && {
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      }),
      statementDay: dto.statementDay,
    });
  }

  @Delete(':id')
  async remove(@Req() req: RequestWithUser, @Param('id') id: string) {
    const objective = await this.objectives.findOneAny(id, req.user.id);
    return this.objectives.remove(id, req.user.id, objective.type, NOT_FOUND);
  }

  @Post(':id/entries')
  async addEntry(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: CreateObjectiveEntryDto,
  ) {
    const objective = await this.objectives.findOneAny(id, req.user.id);

    if (!ALLOWED_ENTRY_TYPES[objective.type].includes(dto.type)) {
      throw new BadRequestException(
        `Entry type ${dto.type} is not valid for a ${objective.type} objective`,
      );
    }

    if (
      (dto.type === 'WITHDRAW' || dto.type === 'PAYMENT') &&
      Number(objective.currentAmount) < dto.amount
    ) {
      throw new BadRequestException(
        dto.type === 'WITHDRAW'
          ? 'No hay suficiente ahorro para retirar'
          : 'El pago no puede ser mayor al saldo pendiente',
      );
    }

    const date = dto.date ? parseDateInput(dto.date) : new Date();

    const updated = await this.objectives.applyEntry({
      objectiveId: id,
      userId: req.user.id,
      amount: dto.amount,
      entryType: dto.type,
      note: dto.note,
      ...(dto.type === 'INCREASE' && {
        installments: dto.installments ?? 1,
      }),
      date,
      linkedTransaction: this.buildLinkedTransaction(
        objective,
        dto.type,
        dto.note,
      ),
      incrementTargetAmount: dto.type === 'INCREASE',
    });

    await this.safeRecalculate(req.user.id);
    return updated;
  }

  @Get(':id/entries')
  async getEntries(@Req() req: RequestWithUser, @Param('id') id: string) {
    await this.objectives.findOneAny(id, req.user.id);
    return this.objectives.getEntries(id, ALL_ENTRY_TYPES);
  }

  @Get(':id/forecast')
  async getForecast(@Req() req: RequestWithUser, @Param('id') id: string) {
    const objective = await this.objectives.findOneAny(id, req.user.id);
    return objective.type === 'SAVING_GOAL'
      ? this.forecastService.computeForecast(id, req.user.id)
      : this.forecastService.computeDebtForecast(id, req.user.id);
  }

  private buildLinkedTransaction(
    objective: { name: string },
    entryType: ObjectiveEntryType,
    note?: string,
  ) {
    if (entryType === 'ADD') {
      return {
        type: 'EXPENSE' as const,
        category: SYSTEM_CATEGORIES.SAVINGS,
        note: note ?? `Ahorro: ${objective.name}`,
      };
    }
    if (entryType === 'WITHDRAW') {
      return {
        type: 'INCOME' as const,
        category: SYSTEM_CATEGORIES.SAVINGS,
        note: note ?? `Retiro: ${objective.name}`,
      };
    }
    if (entryType === 'PAYMENT') {
      return {
        type: 'EXPENSE' as const,
        category: SYSTEM_CATEGORIES.DEBT_PAYMENT,
        note: note ?? `Pago: ${objective.name}`,
      };
    }
    return undefined; // INCREASE never links a Transaction (matches DebtService.addAmount)
  }

  // Forecast recalculation is a derived side effect of the write above, not
  // the write itself — a transient failure here (e.g. a DB hiccup) shouldn't
  // report the entry as failed when it was already committed. Same fix as
  // TransactionsService.safeRecalculate.
  private async safeRecalculate(userId: string) {
    try {
      await this.forecastService.recalculateAllForUser(userId);
    } catch {
      // Ignored on purpose; the next recalculation catches it up.
    }
  }
}
