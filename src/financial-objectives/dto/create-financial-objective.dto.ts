import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { FinancialObjectiveType } from '@prisma/client';

export class CreateFinancialObjectiveDto {
  @IsEnum(FinancialObjectiveType)
  type!: FinancialObjectiveType;

  @IsString()
  name!: string;

  @IsNumber()
  @Min(0.01)
  targetAmount!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  savingAllocation?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  statementDay?: number;
}
