import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { ForecastService } from '../forecast/forecast.service';
import { FinancialObjectivesService } from '../financial-objectives/financial-objectives.service';
import { SYSTEM_CATEGORIES } from '../categories/system-categories.constant';

describe('GoalsService - linked transactions', () => {
  let service: GoalsService;
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
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        { provide: FinancialObjectivesService, useValue: objectives },
        { provide: ForecastService, useValue: forecastService },
      ],
    }).compile();

    service = module.get<GoalsService>(GoalsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addSavings', () => {
    it('creates a linked EXPENSE entry and increments the goal balance', async () => {
      objectives.findOne.mockResolvedValue({
        id: 'goal1',
        userId: 'user1',
        name: 'Vacation',
        currentAmount: 200,
      });
      objectives.applyEntry.mockResolvedValue({
        id: 'goal1',
        userId: 'user1',
        name: 'Vacation',
        currentAmount: 250,
      });

      const result = await service.addSavings('goal1', 'user1', 50);

      expect(objectives.findOne).toHaveBeenCalledWith(
        'goal1',
        'user1',
        'SAVING_GOAL',
        'Goal not found',
      );
      expect(objectives.applyEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          objectiveId: 'goal1',
          userId: 'user1',
          amount: 50,
          entryType: 'ADD',
          linkedTransaction: expect.objectContaining({
            type: 'EXPENSE',
            category: SYSTEM_CATEGORIES.SAVINGS,
          }),
        }),
      );
      expect(forecastService.recalculateAllForUser).toHaveBeenCalledWith(
        'user1',
      );
      expect(result.currentAmount).toBe(250);
    });
  });

  describe('withdrawSavings', () => {
    it('creates a linked INCOME entry and decrements the goal balance', async () => {
      objectives.findOne.mockResolvedValue({
        id: 'goal1',
        userId: 'user1',
        name: 'Vacation',
        currentAmount: 200,
      });
      objectives.applyEntry.mockResolvedValue({
        id: 'goal1',
        userId: 'user1',
        name: 'Vacation',
        currentAmount: 170,
      });

      await service.withdrawSavings('goal1', 'user1', 30);

      expect(objectives.applyEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          objectiveId: 'goal1',
          userId: 'user1',
          amount: 30,
          entryType: 'WITHDRAW',
          linkedTransaction: expect.objectContaining({
            type: 'INCOME',
            category: SYSTEM_CATEGORIES.SAVINGS,
          }),
        }),
      );
    });

    it('rejects a withdrawal larger than the current savings', async () => {
      objectives.findOne.mockResolvedValue({
        id: 'goal1',
        userId: 'user1',
        name: 'Vacation',
        currentAmount: 20,
      });

      await expect(
        service.withdrawSavings('goal1', 'user1', 30),
      ).rejects.toThrow(BadRequestException);

      expect(objectives.applyEntry).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('delegates removal (contributions + snapshots + objective) to FinancialObjectivesService', async () => {
      objectives.remove.mockResolvedValue({ id: 'goal1', userId: 'user1' });

      await service.remove('goal1', 'user1');

      expect(objectives.remove).toHaveBeenCalledWith(
        'goal1',
        'user1',
        'SAVING_GOAL',
        'Goal not found',
      );
    });
  });
});
