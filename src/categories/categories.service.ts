import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, type?: string) {
    const where: Prisma.CategoryWhereInput = { userId };
    if (type) where.type = type;
    return this.prisma.category.findMany({ where, orderBy: { name: 'asc' } });
  }

  async findOne(id: string, userId: string) {
    const cat = await this.prisma.category.findFirst({ where: { id, userId } });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async create(userId: string, dto: CreateCategoryDto) {
    const existing = await this.prisma.category.findUnique({
      where: { userId_name: { userId, name: dto.name } },
    });
    if (existing)
      throw new ConflictException('Ya existe una categoría con ese nombre');

    return this.prisma.category.create({
      data: { userId, name: dto.name, type: dto.type },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.category.delete({ where: { id } });
  }
}
