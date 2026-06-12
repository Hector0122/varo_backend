import { Test, TestingModule } from '@nestjs/testing';
import { ForecastService } from './forecast.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ForecastService', () => {
  let service: ForecastService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      goal: {
        findFirst: jest.fn(),
      },
      transaction: {
        aggregate: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      forecastSnapshot: {
        findFirst: jest.fn(),
        create: jest.fn(),
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

  describe('computeForecast', () => {
    it('should throw NotFoundException if goal not found', async () => {
      prisma.goal.findFirst.mockResolvedValue(null);
      await expect(service.computeForecast('1', 'user1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return forecast with correct remaining amount', async () => {
      prisma.goal.findFirst.mockResolvedValue({
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
      prisma.forecastSnapshot.findFirst.mockResolvedValue(null);
      prisma.forecastSnapshot.create.mockResolvedValue({});

      const result = await service.computeForecast('1', 'user1');

      expect(result.goalId).toBe('1');
      expect(result.goalName).toBe('Casa');
      expect(result.remainingAmount).toBe(80000);
      expect(result.trend).toBe('stable');
      expect(result.confidenceScore).toBe(0.5);
      expect(prisma.forecastSnapshot.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException when no net saving', async () => {
      prisma.goal.findFirst.mockResolvedValue({
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
      prisma.goal.findFirst.mockResolvedValue({
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
      prisma.forecastSnapshot.create.mockResolvedValue({});

      const result = await service.computeForecast('1', 'user1');

      expect(result.remainingAmount).toBe(0);
      expect(result.estimatedDays).toBe(0);
      expect(result.trend).toBe('stable');
    });
  });

  describe('getSnapshots', () => {
    it('should throw NotFoundException if goal not found', async () => {
      prisma.goal.findFirst.mockResolvedValue(null);
      await expect(service.getSnapshots('1', 'user1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return snapshots for goal', async () => {
      prisma.goal.findFirst.mockResolvedValue({ id: '1' });
      prisma.forecastSnapshot.findMany.mockResolvedValue([
        { id: 's1', goalId: '1', confidenceScore: 0.9 },
      ]);

      const result = await service.getSnapshots('1', 'user1');
      expect(result).toHaveLength(1);
      expect(result[0].confidenceScore).toBe(0.9);
    });
  });
});
