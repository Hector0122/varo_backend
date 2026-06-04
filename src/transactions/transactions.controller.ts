import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsService } from './transactions.service';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Get()
  findAll(
    @Request() req,
    @Query('type') type?: string,
    @Query('category') category?: string,
  ) {
    return this.transactionsService.findAll(req.user.id, type, category);
  }

  @Post()
  create(@Request() req, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(req.user.id, dto);
  }

  @Patch(':id')
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.transactionsService.remove(id, req.user.id);
  }
}
