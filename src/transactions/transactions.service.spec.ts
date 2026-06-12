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
      goal: {
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
