import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DebtService } from './debt.service';
import { ForecastService } from '../forecast/forecast.service';
import { FinancialObjectivesService } from '../financial-objectives/financial-objectives.service';
import { SYSTEM_CATEGORIES } from '../categories/system-categories.constant';

describe('DebtService - linked transactions', () => {
  let service: DebtService;
  let objectives: any;
  let forecastService: any;

  beforeEach(async () => {
    objectives = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      applyEntry: jest.fn(),
      getEntries: jest.fn(),
    };

    forecastService = {
      recalculateAllForUser: jest.fn(),
      computeDebtForecast: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DebtService,
        { provide: FinancialObjectivesService, useValue: objectives },
        { provide: ForecastService, useValue: forecastService },
      ],
    }).compile();

    service = module.get<DebtService>(DebtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('makePayment', () => {
    it('creates a linked EXPENSE entry and decrements the debt balance', async () => {
      objectives.findOne.mockResolvedValue({
        id: 'debt1',
        userId: 'user1',
        name: 'Car loan',
        currentAmount: 500,
      });
      objectives.applyEntry.mockResolvedValue({
        id: 'debt1',
        userId: 'user1',
        name: 'Car loan',
        currentAmount: 400,
      });

      const result = await service.makePayment('debt1', 'user1', {
        amount: 100,
      });

      expect(objectives.applyEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          objectiveId: 'debt1',
          userId: 'user1',
          amount: 100,
          entryType: 'PAYMENT',
          linkedTransaction: expect.objectContaining({
            type: 'EXPENSE',
            category: SYSTEM_CATEGORIES.DEBT_PAYMENT,
          }),
        }),
      );
      expect(forecastService.recalculateAllForUser).toHaveBeenCalledWith(
        'user1',
      );
      expect(result.currentAmount).toBe(400);
    });

    it('rejects a payment larger than the remaining balance without creating anything', async () => {
      objectives.findOne.mockResolvedValue({
        id: 'debt1',
        userId: 'user1',
        name: 'Car loan',
        currentAmount: 50,
      });

      await expect(
        service.makePayment('debt1', 'user1', { amount: 100 }),
      ).rejects.toThrow(BadRequestException);

      expect(objectives.applyEntry).not.toHaveBeenCalled();
    });
  });

  describe('addAmount', () => {
    it('does not create a linked transaction for an INCREASE, and grows the target amount', async () => {
      objectives.findOne.mockResolvedValue({
        id: 'debt1',
        userId: 'user1',
        name: 'Credit card',
        currentAmount: 100,
      });
      objectives.applyEntry.mockResolvedValue({
        id: 'debt1',
        userId: 'user1',
        name: 'Credit card',
        currentAmount: 150,
      });

      await service.addAmount('debt1', 'user1', { amount: 50 });

      expect(objectives.applyEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          objectiveId: 'debt1',
          userId: 'user1',
          amount: 50,
          entryType: 'INCREASE',
          incrementTargetAmount: true,
        }),
      );
      expect(
        (
          objectives.applyEntry.mock.calls[0][0] as {
            linkedTransaction?: unknown;
          }
        ).linkedTransaction,
      ).toBeUndefined();
    });
  });

  describe('getForecast', () => {
    it('delegates to ForecastService.computeDebtForecast after verifying ownership', async () => {
      objectives.findOne.mockResolvedValue({ id: 'debt1', userId: 'user1' });
      forecastService.computeDebtForecast.mockResolvedValue({
        debtId: 'debt1',
      });

      const result = await service.getForecast('debt1', 'user1');

      expect(objectives.findOne).toHaveBeenCalledWith(
        'debt1',
        'user1',
        'DEBT_PAYOFF',
        'Debt not found',
      );
      expect(forecastService.computeDebtForecast).toHaveBeenCalledWith(
        'debt1',
        'user1',
      );
      expect(result).toEqual({ debtId: 'debt1' });
    });
  });
});
