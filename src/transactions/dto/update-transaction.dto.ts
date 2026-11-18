import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { CreateTransactionDto } from './create-transaction.dto';

export class UpdateTransactionDto extends PartialType(CreateTransactionDto) {
  /** Con qué se pagó: id de tarjeta o cuenta; null = efectivo. Sin el campo no cambia. */
  @IsOptional()
  @IsString()
  paidWith?: string | null;
}
