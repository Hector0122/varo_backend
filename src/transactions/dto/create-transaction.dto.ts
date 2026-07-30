import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateTransactionDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsIn(['INCOME', 'EXPENSE'])
  type!: string;

  @IsString()
  category!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsDateString()
  date!: string;
}
