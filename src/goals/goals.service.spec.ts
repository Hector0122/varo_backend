import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForecastService } from '../forecast/forecast.service';
import { SYSTEM_CATEGORIES } from '../categories/system-categories.constant';

describe('GoalsService - linked transactions', () => {
  let service: GoalsService;
  let prisma: any;
  let forecastService: any;

  beforeEach(async () => {
    prisma = {
      goal: {
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      goalContribution: {
        create: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
      },
      forecastSnapshot: {
        deleteMany: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback: any) => callback(prisma)),
    };

    forecastService = {
      recalculateAllForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ForecastService, useValue: forecastService },
      ],
    }).compile();

    service = module.get<GoalsService>(GoalsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addSavings', () => {
    it('creates a linked EXPENSE transaction and increments the goal balance', async () => {
      prisma.goal.findFirst.mockResolvedValue({
        id: 'goal1',
        userId: 'user1',
        name: 'Vacation',
        currentAmount: 200,
      });
      prisma.transaction.create.mockResolvedValue({ id: 'tx1' });
      prisma.goal.update.mockResolvedValue({
        id: 'goal1',
        currentAmount: 250,
      });

      const result = await service.addSavings('goal1', 'user1', 50);

      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user1',
          amount: 50,
          type: 'EXPENSE',
          category: SYSTEM_CATEGORIES.SAVINGS,
        }),
      });
      expect(prisma.goalContribution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          goalId: 'goal1',
          amount: 50,
          type: 'ADD',
          transactionId: 'tx1',
        }),
      });
      expect(prisma.goal.update).toHaveBeenCalledWith({
        where: { id: 'goal1' },
        data: { currentAmount: { increment: 50 } },
      });
      expect(forecastService.recalculateAllForUser).toHaveBeenCalledWith(
        'user1',
      );
      expect(result).toEqual({ id: 'goal1', currentAmount: 250 });
    });
  });

  describe('withdrawSavings', () => {
    it('creates a linked INCOME transaction and decrements the goal balance', async () => {
      prisma.goal.findFirst.mockResolvedValue({
        id: 'goal1',
        userId: 'user1',
        name: 'Vacation',
        currentAmount: 200,
      });
      prisma.transaction.create.mockResolvedValue({ id: 'tx2' });
      prisma.goal.update.mockResolvedValue({
        id: 'goal1',
        currentAmount: 170,
      });

      await service.withdrawSavings('goal1', 'user1', 30);

      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user1',
          amount: 30,
          type: 'INCOME',
          category: SYSTEM_CATEGORIES.SAVINGS,
        }),
      });
      expect(prisma.goalContribution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          goalId: 'goal1',
          amount: 30,
          type: 'WITHDRAW',
          transactionId: 'tx2',
        }),
      });
    });

    it('rejects a withdrawal larger than the current savings', async () => {
      prisma.goal.findFirst.mockResolvedValue({
        id: 'goal1',
        userId: 'user1',
        name: 'Vacation',
        currentAmount: 20,
      });

      await expect(
        service.withdrawSavings('goal1', 'user1', 30),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes goal contributions and snapshots before deleting the goal', async () => {
      prisma.goal.findFirst.mockResolvedValue({ id: 'goal1', userId: 'user1' });
      prisma.goal.delete.mockResolvedValue({ id: 'goal1' });

      await service.remove('goal1', 'user1');

      expect(prisma.forecastSnapshot.deleteMany).toHaveBeenCalledWith({
        where: { goalId: 'goal1' },
      });
      expect(prisma.goalContribution.deleteMany).toHaveBeenCalledWith({
        where: { goalId: 'goal1' },
      });
      expect(prisma.goal.delete).toHaveBeenCalledWith({
        where: { id: 'goal1' },
      });
    });
  });
});
