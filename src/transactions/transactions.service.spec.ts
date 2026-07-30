import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForecastService } from '../forecast/forecast.service';
import { ConfigService } from '@nestjs/config';

describe('TransactionsService - exportToCsv', () => {
  let service: TransactionsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      transaction: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ForecastService,
          useValue: { computeForecast: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should export transactions to CSV', async () => {
    prisma.transaction.findMany.mockResolvedValue([
      {
        id: '1',
        date: new Date('2024-01-15'),
        type: 'EXPENSE',
        category: 'Comida',
        amount: 250.5,
        note: 'Almuerzo',
      },
      {
        id: '2',
        date: new Date('2024-01-20'),
        type: 'INCOME',
        category: 'Salario',
        amount: 15000,
        note: null,
      },
    ]);

    const csv = await service.exportToCsv('user1');

    expect(csv).toContain('Fecha,Tipo,Categoria,Monto,Nota');
    expect(csv).toContain('2024-01-15,EXPENSE,Comida,250.5,Almuerzo');
    expect(csv).toContain('2024-01-20,INCOME,Salario,15000,');
    expect(prisma.transaction.findMany).toHaveBeenCalledWith({
      where: { userId: 'user1' },
      orderBy: { date: 'desc' },
    });
  });

  it('should handle empty transactions', async () => {
    prisma.transaction.findMany.mockResolvedValue([]);

    const csv = await service.exportToCsv('user1');

    expect(csv).toBe('Fecha,Tipo,Categoria,Monto,Nota');
  });

  it('should escape quotes and commas in fields', async () => {
    prisma.transaction.findMany.mockResolvedValue([
      {
        id: '1',
        date: new Date('2024-01-15'),
        type: 'EXPENSE',
        category: 'Super, mercado',
        amount: 100,
        note: 'Compra "especial"',
      },
    ]);

    const csv = await service.exportToCsv('user1');

    expect(csv).toContain('"Super, mercado"');
    expect(csv).toContain('"Compra ""especial"""');
  });
});

describe('TransactionsService - linked transaction sync', () => {
  let service: TransactionsService;
  let prisma: any;
  let forecastService: any;

  beforeEach(async () => {
    prisma = {
      transaction: {
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      objectiveEntry: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        delete: jest.fn(),
      },
      financialObjective: {
        update: jest.fn(),
      },
      $transaction: jest.fn((callback: any) => callback(prisma)),
    };

    forecastService = { recalculateAllForUser: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ForecastService, useValue: forecastService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  describe('remove', () => {
    it('deletes a plain transaction without touching any objective', async () => {
      prisma.transaction.findFirst.mockResolvedValue({
        id: 'tx1',
        userId: 'user1',
        amount: 50,
      });
      prisma.transaction.delete.mockResolvedValue({ id: 'tx1' });

      await service.remove('tx1', 'user1');

      expect(prisma.financialObjective.update).not.toHaveBeenCalled();
      expect(prisma.transaction.delete).toHaveBeenCalledWith({
        where: { id: 'tx1' },
      });
    });

    it('reverses the debt balance when deleting a linked payment transaction', async () => {
      prisma.transaction.findFirst.mockResolvedValue({
        id: 'tx1',
        userId: 'user1',
        amount: 100,
      });
      prisma.objectiveEntry.findUnique.mockResolvedValue({
        id: 'entry1',
        objectiveId: 'debt1',
        amount: 100,
        type: 'PAYMENT',
        objective: { type: 'DEBT_PAYOFF' },
      });
      prisma.transaction.delete.mockResolvedValue({ id: 'tx1' });

      await service.remove('tx1', 'user1');

      expect(prisma.objectiveEntry.delete).toHaveBeenCalledWith({
        where: { id: 'entry1' },
      });
      expect(prisma.financialObjective.update).toHaveBeenCalledWith({
        where: { id: 'debt1' },
        data: { currentAmount: { increment: 100 } },
      });
    });

    it('reverses the goal balance when deleting a linked contribution transaction', async () => {
      prisma.transaction.findFirst.mockResolvedValue({
        id: 'tx2',
        userId: 'user1',
        amount: 50,
      });
      prisma.objectiveEntry.findUnique.mockResolvedValue({
        id: 'entry2',
        objectiveId: 'goal1',
        amount: 50,
        type: 'ADD',
        objective: { type: 'SAVING_GOAL' },
      });
      prisma.transaction.delete.mockResolvedValue({ id: 'tx2' });

      await service.remove('tx2', 'user1');

      expect(prisma.objectiveEntry.delete).toHaveBeenCalledWith({
        where: { id: 'entry2' },
      });
      expect(prisma.financialObjective.update).toHaveBeenCalledWith({
        where: { id: 'goal1' },
        data: { currentAmount: { increment: -50 } },
      });
    });
  });

  describe('update', () => {
    it('re-deltas the debt balance when a linked payment amount changes', async () => {
      prisma.transaction.findFirst.mockResolvedValue({
        id: 'tx1',
        userId: 'user1',
        amount: 100,
      });
      prisma.objectiveEntry.findUnique.mockResolvedValue({
        id: 'entry1',
        objectiveId: 'debt1',
        amount: 100,
        type: 'PAYMENT',
        objective: { type: 'DEBT_PAYOFF' },
      });
      prisma.transaction.update.mockResolvedValue({ id: 'tx1', amount: 120 });

      await service.update('tx1', 'user1', { amount: 120 });

      expect(prisma.objectiveEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry1' },
        data: { amount: 120 },
      });
      expect(prisma.financialObjective.update).toHaveBeenCalledWith({
        where: { id: 'debt1' },
        data: { currentAmount: { increment: -20 } },
      });
      expect(forecastService.recalculateAllForUser).toHaveBeenCalledWith(
        'user1',
      );
    });

    it('does not touch objective balances when the amount is unchanged', async () => {
      prisma.transaction.findFirst.mockResolvedValue({
        id: 'tx1',
        userId: 'user1',
        amount: 100,
      });
      prisma.objectiveEntry.findUnique.mockResolvedValue({
        id: 'entry1',
        objectiveId: 'debt1',
        amount: 100,
        type: 'PAYMENT',
        objective: { type: 'DEBT_PAYOFF' },
      });
      prisma.transaction.update.mockResolvedValue({ id: 'tx1', amount: 100 });

      await service.update('tx1', 'user1', { note: 'updated note' });

      expect(prisma.objectiveEntry.update).not.toHaveBeenCalled();
      expect(prisma.financialObjective.update).not.toHaveBeenCalled();
    });
  });
});
