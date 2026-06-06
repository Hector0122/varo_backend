import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ForecastService } from '../forecast/forecast.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private forecastService: ForecastService,
    private configService: ConfigService,
  ) {}

  private async recalculateForecasts(userId: string) {
    const goals = await this.prisma.goal.findMany({ where: { userId } });
    for (const goal of goals) {
      try {
        await this.forecastService.computeForecast(goal.id, userId);
      } catch {
        // Ignorar metas que no pueden generar forecast (ahorro <= 0)
      }
    }
  }

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

    const data: any = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new BadRequestException(
        'No se pudieron extraer datos del ticket',
      );
    }

    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      throw new BadRequestException(
        'Error al parsear los datos extraídos',
      );
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
        date: new Date(dto.date),
      },
    });
    await this.recalculateForecasts(userId);
    return tx;
  }

  async update(id: string, userId: string, dto: UpdateTransactionDto) {
    await this.findOne(id, userId);

    const tx = await this.prisma.transaction.update({
      where: { id },
      data: {
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.type && { type: dto.type }),
        ...(dto.category && { category: dto.category }),
        ...(dto.note !== undefined && { note: dto.note }),
        ...(dto.date && { date: new Date(dto.date) }),
      },
    });
    await this.recalculateForecasts(userId);
    return tx;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    const tx = await this.prisma.transaction.delete({ where: { id } });
    await this.recalculateForecasts(userId);
    return tx;
  }
}
