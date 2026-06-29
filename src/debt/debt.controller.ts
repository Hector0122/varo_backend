import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequestWithUser } from '../types/request-with-user';
import { DebtService } from './debt.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';
import { MakePaymentDto } from './dto/make-payment.dto';
import { AddAmountDto } from './dto/add-amount.dto';

@UseGuards(JwtAuthGuard)
@Controller('debts')
export class DebtController {
  constructor(private debtService: DebtService) {}

  @Get()
  findAll(@Req() req: RequestWithUser) {
    return this.debtService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.debtService.findOne(id, req.user.id);
  }

  @Post()
  create(@Req() req: RequestWithUser, @Body() dto: CreateDebtDto) {
    return this.debtService.create(req.user.id, dto);
  }

  @Patch(':id')
  update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateDebtDto,
  ) {
    return this.debtService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  remove(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.debtService.remove(id, req.user.id);
  }

  @Post(':id/pay')
  makePayment(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: MakePaymentDto,
  ) {
    return this.debtService.makePayment(id, req.user.id, dto);
  }

  @Post(':id/add')
  addAmount(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: AddAmountDto,
  ) {
    return this.debtService.addAmount(id, req.user.id, dto);
  }

  @Get(':id/payments')
  getPayments(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.debtService.getPayments(id, req.user.id);
  }

  @Get('spending/monthly')
  getMonthlySpending(@Req() req: RequestWithUser) {
    return this.debtService.getMonthlySpending(req.user.id);
  }
}
