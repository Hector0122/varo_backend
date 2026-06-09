import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateDebtDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0.01)
  totalAmount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentAmount?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
