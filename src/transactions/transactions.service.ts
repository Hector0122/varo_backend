import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ForecastService } from '../forecast/forecast.service';
import { objectiveEntrySign } from '../financial-objectives/financial-objectives.service';
import { PDFParse } from 'pdf-parse';
import { parseDateInput } from '../common/date.util';
import { parseStatement } from './statement.parser';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private forecastService: ForecastService,
    private configService: ConfigService,
  ) {}

  async findAll(
    userId: string,
    type?: string,
    category?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ) {
    const where: Prisma.TransactionWhereInput = { userId };
    if (type) where.type = type;
    if (category) where.category = category;

    const orderBy: Prisma.TransactionOrderByWithRelationInput = {};
    if (sortBy === 'amount') {
      orderBy.amount = sortOrder || 'desc';
    } else if (sortBy === 'date') {
      orderBy.date = sortOrder || 'desc';
    } else {
      orderBy.date = 'desc';
    }

    return this.prisma.transaction.findMany({ where, orderBy });
  }

  async findOne(id: string, userId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return transaction;
  }

  async scanReceipt(image: string) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('GROQ_API_KEY no configurada');
    }

    // Groq tiene un límite aproximado de 4MB para imágenes base64,
    // pero protegemos el tier gratuito con un tope más bajo
    const base64SizeMB = Buffer.byteLength(image, 'utf8') / (1024 * 1024);
    if (base64SizeMB > 1.5) {
      throw new BadRequestException(
        `La imagen es demasiado grande (${base64SizeMB.toFixed(1)}MB). Intenta con una foto de menor resolución o más cercana al ticket.`,
      );
    }

    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extrae los datos de este ticket/comprobante. Solo necesito el TOTAL FINAL a pagar, la fecha de la transacción, una categoría general y el nombre del lugar/establecimiento. Ignora completamente el desglose de items individuales; este ticket representa UN SOLO movimiento. Devuelve SOLO un JSON válido con: amount (número, el total final), category (string: "Comida", "Transporte", "Supermercado", "Servicios", "Salud", "Entretenimiento", "Ropa", "Otro"), note (string: nombre del lugar/establecimiento), date (YYYY-MM-DD, la fecha del ticket o hoy si no aparece), type ("EXPENSE"). Sin texto adicional, solo el JSON.',
                },
                { type: 'image_url', image_url: { url: image } },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 500,
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new BadRequestException(
        `Error al procesar imagen: ${response.status} ${errorBody}`,
      );
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content: string = data.choices?.[0]?.message?.content ?? '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new BadRequestException('No se pudieron extraer datos del ticket');
    }

    try {
      return JSON.parse(jsonMatch[0]) as {
        amount: number;
        category: string;
        note: string;
        date: string;
        type: 'EXPENSE';
      };
    } catch {
      throw new BadRequestException('Error al parsear los datos extraídos');
    }
  }

  async create(userId: string, dto: CreateTransactionDto) {
    const tx = await this.prisma.transaction.create({
      data: {
        userId,
        amount: dto.amount,
        type: dto.type,
        category: dto.category,
        note: dto.note ?? null,
        date: parseDateInput(dto.date),
      },
    });
    await this.safeRecalculate(userId);
    return tx;
  }

  async update(id: string, userId: string, dto: UpdateTransactionDto) {
    const existing = await this.findOne(id, userId);

    const entry = await this.prisma.objectiveEntry.findUnique({
      where: { transactionId: id },
      include: { objective: true },
    });

    const amountChanged =
      dto.amount !== undefined &&
      Number(dto.amount) !== Number(existing.amount);
    const delta = amountChanged
      ? Number(dto.amount) - Number(existing.amount)
      : 0;

    const tx = await this.prisma.$transaction(async (txClient) => {
      if (amountChanged && entry) {
        await txClient.objectiveEntry.update({
          where: { id: entry.id },
          data: { amount: dto.amount },
        });
        const sign = objectiveEntrySign(entry.objective.type, entry.type);
        await txClient.financialObjective.update({
          where: { id: entry.objectiveId },
          data: { currentAmount: { increment: sign * delta } },
        });
      }
      return txClient.transaction.update({
        where: { id },
        data: {
          ...(dto.amount !== undefined && { amount: dto.amount }),
          ...(dto.type && { type: dto.type }),
          ...(dto.category && { category: dto.category }),
          ...(dto.note !== undefined && { note: dto.note }),
          ...(dto.date && { date: parseDateInput(dto.date) }),
        },
      });
    });

    await this.safeRecalculate(userId);
    return tx;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    const entry = await this.prisma.objectiveEntry.findUnique({
      where: { transactionId: id },
      include: { objective: true },
    });

    const tx = await this.prisma.$transaction(async (txClient) => {
      if (entry) {
        await txClient.objectiveEntry.delete({ where: { id: entry.id } });
        const sign = objectiveEntrySign(entry.objective.type, entry.type);
        const balanceDelta = -sign * Number(entry.amount);
        await txClient.financialObjective.update({
          where: { id: entry.objectiveId },
          data: { currentAmount: { increment: balanceDelta } },
        });
      }
      return txClient.transaction.delete({ where: { id } });
    });

    await this.safeRecalculate(userId);
    return tx;
  }

  // El recálculo de forecast es un efecto derivado, no la escritura principal:
  // un hipo transitorio aquí (p.ej. conexión a la BD) no debe reportarse como
  // fallo del guardado/actualización/borrado que ya se confirmó.
  /** Varios movimientos de una vez (importar estado de cuenta): un solo recálculo. */
  async createMany(userId: string, dtos: CreateTransactionDto[]) {
    const { count } = await this.prisma.transaction.createMany({
      data: dtos.map((dto) => ({
        userId,
        amount: dto.amount,
        type: dto.type,
        category: dto.category,
        note: dto.note ?? null,
        date: parseDateInput(dto.date),
      })),
    });
    // Categorías nuevas que haya sugerido la IA, para que aparezcan en la app.
    await this.prisma.category.createMany({
      data: [...new Map(dtos.map((d) => [d.category, d.type])).entries()].map(
        ([name, type]) => ({ userId, name, type }),
      ),
      skipDuplicates: true,
    });
    await this.safeRecalculate(userId);
    return { count };
  }

  /**
   * Lee el PDF de un estado de cuenta y devuelve sus movimientos con una
   * categoría sugerida, para que el usuario los revise antes de guardar.
   * A la IA solo van las descripciones (sin nombre, dirección ni cuenta).
   */
  async importStatement(userId: string, file?: { buffer: Buffer }) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Sube el PDF del estado de cuenta');
    }
    const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
    let text: string;
    try {
      text = (await parser.getText()).text;
    } catch {
      throw new BadRequestException('No se pudo leer el PDF');
    } finally {
      await parser.destroy().catch(() => {});
    }

    const rows = parseStatement(text);
    if (!rows.length) {
      throw new BadRequestException(
        'No encontré movimientos en este PDF. ¿Es un estado de cuenta con texto (no escaneado)?',
      );
    }

    const categories = await this.prisma.category.findMany({
      where: { userId, type: { in: ['EXPENSE', 'BOTH'] } },
      select: { name: true },
    });
    const expenses = [
      ...new Set(
        rows.filter((r) => r.type === 'EXPENSE').map((r) => r.description),
      ),
    ];
    const map = await this.categorize(
      expenses,
      categories.map((c) => c.name),
    ).catch((): Record<string, string> => ({}));
    return rows.map((r) => ({
      ...r,
      category: r.type === 'INCOME' ? 'Abono' : (map[r.description] ?? 'Otro'),
    }));
  }

  private async categorize(
    descriptions: string[],
    userCategories: string[],
  ): Promise<Record<string, string>> {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (!apiKey || !descriptions.length) return {};
    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 8000,
          messages: [
            {
              role: 'user',
              content:
                'Son descripciones de cargos de un estado de cuenta bancario en México. Asigna una categoría de gasto a cada una. ' +
                `Usa de preferencia las categorías del usuario: ${JSON.stringify(userCategories)}. ` +
                'Si ninguna encaja usa una de: Comida, Supermercado, Transporte, Gasolina, Servicios, Suscripciones, Salud, Entretenimiento, Ropa, Hogar, Intereses y comisiones, Otro. ' +
                'Devuelve SOLO JSON con la forma {"categorias": {"<descripción exacta>": "<categoría>"}}.\n' +
                JSON.stringify(descriptions),
            },
          ],
        }),
      },
    );
    if (!response.ok) return {};
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as {
      categorias?: Record<string, string>;
    };
    return parsed.categorias ?? {};
  }

  private async safeRecalculate(userId: string) {
    try {
      await this.forecastService.recalculateAllForUser(userId);
    } catch {
      // Ignorado a propósito; el próximo recálculo (otra mutación, o el cron)
      // lo pondrá al día.
    }
  }

  async exportToCsv(userId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });

    const headers = ['Fecha', 'Tipo', 'Categoria', 'Monto', 'Nota'];
    const rows = transactions.map((t) => [
      t.date.toISOString().split('T')[0],
      t.type,
      t.category,
      t.amount.toString(),
      t.note ?? '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((cell) => {
            const escaped = String(cell).replace(/"/g, '""');
            if (
              escaped.includes(',') ||
              escaped.includes('\n') ||
              escaped.includes('"')
            ) {
              return `"${escaped}"`;
            }
            return escaped;
          })
          .join(','),
      ),
    ].join('\n');

    return csv;
  }
}
