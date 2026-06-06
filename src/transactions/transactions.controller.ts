import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequestWithUser } from '../types/request-with-user';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ScanReceiptDto } from './dto/scan-receipt.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsService } from './transactions.service';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Get()
  findAll(
    @Req() req: RequestWithUser,
    @Query('type') type?: string,
    @Query('category') category?: string,
  ) {
    return this.transactionsService.findAll(req.user.id, type, category);
  }

  @Post()
  create(@Req() req: RequestWithUser, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(req.user.id, dto);
  }

  @Post('scan-receipt')
  scanReceipt(@Body() dto: ScanReceiptDto) {
    return this.transactionsService.scanReceipt(dto.image);
  }

  @Patch(':id')
  update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  remove(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.transactionsService.remove(id, req.user.id);
  }
}
