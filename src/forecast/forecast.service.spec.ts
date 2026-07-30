import { Test, TestingModule } from '@nestjs/testing';
import { ForecastService } from './forecast.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ForecastService', () => {
  let service: ForecastService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      financialObjective: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      transaction: {
        aggregate: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      objectiveForecastSnapshot: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      objectiveEntry: {
        aggregate: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForecastService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ForecastService>(ForecastService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('computeForecast (Goal)', () => {
    it('should throw NotFoundException if goal not found', async () => {
      prisma.financialObjective.findFirst.mockResolvedValue(null);
      await expect(service.computeForecast('1', 'user1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return forecast with correct remaining amount', async () => {
      prisma.financialObjective.findFirst.mockResolvedValue({
        id: '1',
        name: 'Casa',
        targetAmount: 100000,
        currentAmount: 20000,
        savingAllocation: 100,
      });
      prisma.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 50000 } }) // income
        .mockResolvedValueOnce({ _sum: { amount: 20000 } }); // expense
      prisma.transaction.findFirst.mockResolvedValue({
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      });
      prisma.transaction.count.mockResolvedValue(10);
      prisma.objectiveForecastSnapshot.findFirst.mockResolvedValue(null);
      prisma.objectiveForecastSnapshot.create.mockResolvedValue({});

      const result = await service.computeForecast('1', 'user1');

      expect(result.goalId).toBe('1');
      expect(result.goalName).toBe('Casa');
      expect(result.remainingAmount).toBe(80000);
      expect(result.trend).toBe('stable');
      expect(result.confidenceScore).toBe(0.5);
      expect(prisma.objectiveForecastSnapshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ objectiveId: '1' }),
      });
    });

    it('should throw BadRequestException when no net saving', async () => {
      prisma.financialObjective.findFirst.mockResolvedValue({
        id: '1',
        name: 'Casa',
        targetAmount: 100000,
        currentAmount: 20000,
        savingAllocation: 100,
      });
      prisma.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 10000 } }) // income
        .mockResolvedValueOnce({ _sum: { amount: 10000 } }); // expense
      prisma.transaction.findFirst.mockResolvedValue({
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      });

      await expect(service.computeForecast('1', 'user1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return completed goal when remaining <= 0', async () => {
      prisma.financialObjective.findFirst.mockResolvedValue({
        id: '1',
        name: 'Casa',
        targetAmount: 100000,
        currentAmount: 100000,
        savingAllocation: 100,
      });
      prisma.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 50000 } })
        .mockResolvedValueOnce({ _sum: { amount: 20000 } });
      prisma.transaction.findFirst.mockResolvedValue({
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      });
      prisma.objectiveForecastSnapshot.create.mockResolvedValue({});

      const result = await service.computeForecast('1', 'user1');

      expect(result.remainingAmount).toBe(0);
      expect(result.estimatedDays).toBe(0);
      expect(result.trend).toBe('stable');
    });
  });

  describe('computeDebtForecast (Debt)', () => {
    it('should throw NotFoundException if debt not found', async () => {
      prisma.financialObjective.findFirst.mockResolvedValue(null);
      await expect(
        service.computeDebtForecast('debt1', 'user1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return remainingAmount 0 without throwing when debt is paid off', async () => {
      prisma.financialObjective.findFirst.mockResolvedValue({
        id: 'debt1',
        name: 'Tarjeta',
        currentAmount: 0,
        createdAt: new Date(),
      });
      prisma.objectiveForecastSnapshot.create.mockResolvedValue({});

      const result = await service.computeDebtForecast('debt1', 'user1');

      expect(result.remainingAmount).toBe(0);
      expect(result.trend).toBe('stable');
      expect(result.confidenceScore).toBe(1);
    });

    it('should return a no-projection response without throwing when there are no payments yet', async () => {
      prisma.financialObjective.findFirst.mockResolvedValue({
        id: 'debt1',
        name: 'Tarjeta',
        currentAmount: 1000,
        createdAt: new Date(),
      });
      prisma.objectiveEntry.aggregate.mockResolvedValue({
        _sum: { amount: null },
        _count: 0,
      });

      const result = await service.computeDebtForecast('debt1', 'user1');

      expect(result.remainingAmount).toBe(1000);
      expect(result.avgMonthlyPayment).toBe(0);
      expect(result.confidenceScore).toBe(0);
      expect(prisma.objectiveForecastSnapshot.create).not.toHaveBeenCalled();
    });

    it('should compute an "up" trend when the payoff rate increased vs. the previous snapshot', async () => {
      prisma.financialObjective.findFirst.mockResolvedValue({
        id: 'debt1',
        name: 'Tarjeta',
        currentAmount: 1000,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      });
      prisma.objectiveEntry.aggregate.mockResolvedValue({
        _sum: { amount: 600 },
        _count: 3,
      });
      prisma.objectiveForecastSnapshot.findFirst.mockResolvedValue({
        monthlyRate: 400,
      });
      prisma.objectiveForecastSnapshot.create.mockResolvedValue({});

      const result = await service.computeDebtForecast('debt1', 'user1');

      expect(result.trend).toBe('up');
      expect(prisma.objectiveForecastSnapshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ objectiveId: 'debt1' }),
      });
    });

    it('should default to "stable" trend when there is no prior snapshot', async () => {
      prisma.financialObjective.findFirst.mockResolvedValue({
        id: 'debt1',
        name: 'Tarjeta',
        currentAmount: 1000,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      });
      prisma.objectiveEntry.aggregate.mockResolvedValue({
        _sum: { amount: 500 },
        _count: 2,
      });
      prisma.objectiveForecastSnapshot.findFirst.mockResolvedValue(null);
      prisma.objectiveForecastSnapshot.create.mockResolvedValue({});

      const result = await service.computeDebtForecast('debt1', 'user1');

      expect(result.trend).toBe('stable');
    });
  });
});
