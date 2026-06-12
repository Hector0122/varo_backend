import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateRecurringTransactionDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsIn(['INCOME', 'EXPENSE'])
  type: string;

  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsIn(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY'])
  frequency: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
