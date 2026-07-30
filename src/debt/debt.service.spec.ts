import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DebtService } from './debt.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForecastService } from '../forecast/forecast.service';
import { SYSTEM_CATEGORIES } from '../categories/system-categories.constant';

describe('DebtService - linked transactions', () => {
  let service: DebtService;
  let prisma: any;
  let forecastService: any;

  beforeEach(async () => {
    prisma = {
      debt: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      debtPayment: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback: any) => callback(prisma)),
      transaction: {
        create: jest.fn(),
      },
    };

    forecastService = {
      recalculateAllForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DebtService,
        { provide: PrismaService, useValue: prisma },
        { provide: ForecastService, useValue: forecastService },
      ],
    }).compile();

    service = module.get<DebtService>(DebtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('makePayment', () => {
    it('creates a linked EXPENSE transaction and decrements the debt balance', async () => {
      prisma.debt.findFirst.mockResolvedValue({
        id: 'debt1',
        userId: 'user1',
        name: 'Car loan',
        currentAmount: 500,
      });
      prisma.transaction.create.mockResolvedValue({ id: 'tx1' });
      prisma.debt.update.mockResolvedValue({
        id: 'debt1',
        currentAmount: 400,
      });

      const result = await service.makePayment('debt1', 'user1', {
        amount: 100,
      });

      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user1',
          amount: 100,
          type: 'EXPENSE',
          category: SYSTEM_CATEGORIES.DEBT_PAYMENT,
        }),
      });
      expect(prisma.debtPayment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          debtId: 'debt1',
          amount: 100,
          type: 'PAYMENT',
          transactionId: 'tx1',
        }),
      });
      expect(prisma.debt.update).toHaveBeenCalledWith({
        where: { id: 'debt1' },
        data: { currentAmount: { decrement: 100 } },
      });
      expect(forecastService.recalculateAllForUser).toHaveBeenCalledWith(
        'user1',
      );
      expect(result).toEqual({ id: 'debt1', currentAmount: 400 });
    });

    it('rejects a payment larger than the remaining balance without creating anything', async () => {
      prisma.debt.findFirst.mockResolvedValue({
        id: 'debt1',
        userId: 'user1',
        name: 'Car loan',
        currentAmount: 50,
      });

      await expect(
        service.makePayment('debt1', 'user1', { amount: 100 }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.transaction.create).not.toHaveBeenCalled();
      expect(prisma.debtPayment.create).not.toHaveBeenCalled();
    });
  });

  describe('addAmount', () => {
    it('does not create a linked transaction for an INCREASE', async () => {
      prisma.debt.findFirst.mockResolvedValue({
        id: 'debt1',
        userId: 'user1',
        name: 'Credit card',
        currentAmount: 100,
      });
      prisma.debt.update.mockResolvedValue({
        id: 'debt1',
        currentAmount: 150,
      });

      await service.addAmount('debt1', 'user1', { amount: 50 });

      expect(prisma.transaction.create).not.toHaveBeenCalled();
      expect(prisma.debtPayment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          debtId: 'debt1',
          amount: 50,
          type: 'INCREASE',
        }),
      });
    });
  });
});
