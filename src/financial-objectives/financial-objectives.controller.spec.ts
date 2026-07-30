import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FinancialObjectivesController } from './financial-objectives.controller';
import { FinancialObjectivesService } from './financial-objectives.service';
import { ForecastService } from '../forecast/forecast.service';

describe('FinancialObjectivesController', () => {
  let controller: FinancialObjectivesController;
  let objectives: any;
  let forecastService: any;

  const req = { user: { id: 'user1' } } as any;

  beforeEach(async () => {
    objectives = {
      findAllAny: jest.fn(),
      findOneAny: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      applyEntry: jest.fn(),
      getEntries: jest.fn(),
    };
    forecastService = {
      computeForecast: jest.fn(),
      computeDebtForecast: jest.fn(),
      recalculateAllForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinancialObjectivesController],
      providers: [
        { provide: FinancialObjectivesService, useValue: objectives },
        { provide: ForecastService, useValue: forecastService },
      ],
    }).compile();

    controller = module.get<FinancialObjectivesController>(
      FinancialObjectivesController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('passes an optional type filter through to the service', async () => {
      objectives.findAllAny.mockResolvedValue([]);
      await controller.findAll(req, 'DEBT_PAYOFF');
      expect(objectives.findAllAny).toHaveBeenCalledWith(
        'user1',
        'DEBT_PAYOFF',
      );
    });
  });

  describe('addEntry', () => {
    it('rejects an entry type not valid for the objective type', async () => {
      objectives.findOneAny.mockResolvedValue({
        id: 'obj1',
        type: 'SAVING_GOAL',
        name: 'Viaje',
        currentAmount: 100,
      });

      await expect(
        controller.addEntry(req, 'obj1', {
          type: 'PAYMENT',
          amount: 10,
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(objectives.applyEntry).not.toHaveBeenCalled();
    });

    it('rejects a WITHDRAW larger than the current balance', async () => {
      objectives.findOneAny.mockResolvedValue({
        id: 'obj1',
        type: 'SAVING_GOAL',
        name: 'Viaje',
        currentAmount: 50,
      });

      await expect(
        controller.addEntry(req, 'obj1', {
          type: 'WITHDRAW',
          amount: 100,
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(objectives.applyEntry).not.toHaveBeenCalled();
    });

    it('rejects a PAYMENT larger than the current balance', async () => {
      objectives.findOneAny.mockResolvedValue({
        id: 'debt1',
        type: 'DEBT_PAYOFF',
        name: 'BBVA',
        currentAmount: 50,
      });

      await expect(
        controller.addEntry(req, 'debt1', {
          type: 'PAYMENT',
          amount: 100,
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(objectives.applyEntry).not.toHaveBeenCalled();
    });

    it('links an EXPENSE transaction for a goal ADD entry', async () => {
      objectives.findOneAny.mockResolvedValue({
        id: 'obj1',
        type: 'SAVING_GOAL',
        name: 'Viaje',
        currentAmount: 50,
      });
      objectives.applyEntry.mockResolvedValue({ id: 'obj1' });

      await controller.addEntry(req, 'obj1', {
        type: 'ADD',
        amount: 20,
      } as any);

      expect(objectives.applyEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          objectiveId: 'obj1',
          userId: 'user1',
          entryType: 'ADD',
          linkedTransaction: expect.objectContaining({ type: 'EXPENSE' }),
        }),
      );
      expect(forecastService.recalculateAllForUser).toHaveBeenCalledWith(
        'user1',
      );
    });

    it('does not link a transaction for a debt INCREASE entry, and increments the target', async () => {
      objectives.findOneAny.mockResolvedValue({
        id: 'debt1',
        type: 'DEBT_PAYOFF',
        name: 'BBVA',
        currentAmount: 50,
      });
      objectives.applyEntry.mockResolvedValue({ id: 'debt1' });

      await controller.addEntry(req, 'debt1', {
        type: 'INCREASE',
        amount: 20,
        installments: 3,
      } as any);

      expect(objectives.applyEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          entryType: 'INCREASE',
          installments: 3,
          incrementTargetAmount: true,
          linkedTransaction: undefined,
        }),
      );
    });

    it('does not fail the request when forecast recalculation throws', async () => {
      objectives.findOneAny.mockResolvedValue({
        id: 'obj1',
        type: 'SAVING_GOAL',
        name: 'Viaje',
        currentAmount: 50,
      });
      objectives.applyEntry.mockResolvedValue({ id: 'obj1' });
      forecastService.recalculateAllForUser.mockRejectedValue(
        new Error('transient db hiccup'),
      );

      await expect(
        controller.addEntry(req, 'obj1', { type: 'ADD', amount: 20 } as any),
      ).resolves.toEqual({ id: 'obj1' });
    });
  });

  describe('getMonthlySpending', () => {
    it('sums INCREASE entries falling in the current billing cycle for each debt', async () => {
      const now = new Date();
      const statementDay = now.getDate();

      objectives.findAllAny.mockResolvedValue([
        {
          id: 'debt1',
          type: 'DEBT_PAYOFF',
          statementDay,
          createdAt: now,
        },
      ]);
      objectives.getEntries.mockResolvedValue([
        { amount: 100, installments: 1, purchaseDate: now, createdAt: now },
      ]);

      const result = await controller.getMonthlySpending(req);

      expect(objectives.findAllAny).toHaveBeenCalledWith(
        'user1',
        'DEBT_PAYOFF',
      );
      expect(result).toEqual([
        expect.objectContaining({ debtId: 'debt1', monthlySpending: 100 }),
      ]);
    });

    it('splits an installment purchase evenly across its cycles', async () => {
      const now = new Date();
      const statementDay = now.getDate();

      objectives.findAllAny.mockResolvedValue([
        {
          id: 'debt1',
          type: 'DEBT_PAYOFF',
          statementDay,
          createdAt: now,
        },
      ]);
      objectives.getEntries.mockResolvedValue([
        { amount: 300, installments: 3, purchaseDate: now, createdAt: now },
      ]);

      const result = await controller.getMonthlySpending(req);

      expect(result).toEqual([
        expect.objectContaining({ debtId: 'debt1', monthlySpending: 100 }),
      ]);
    });
  });

  describe('getForecast', () => {
    it('dispatches to computeForecast for a SAVING_GOAL', async () => {
      objectives.findOneAny.mockResolvedValue({
        id: 'obj1',
        type: 'SAVING_GOAL',
      });
      await controller.getForecast(req, 'obj1');
      expect(forecastService.computeForecast).toHaveBeenCalledWith(
        'obj1',
        'user1',
      );
      expect(forecastService.computeDebtForecast).not.toHaveBeenCalled();
    });

    it('dispatches to computeDebtForecast for a DEBT_PAYOFF', async () => {
      objectives.findOneAny.mockResolvedValue({
        id: 'debt1',
        type: 'DEBT_PAYOFF',
      });
      await controller.getForecast(req, 'debt1');
      expect(forecastService.computeDebtForecast).toHaveBeenCalledWith(
        'debt1',
        'user1',
      );
      expect(forecastService.computeForecast).not.toHaveBeenCalled();
    });
  });
});
