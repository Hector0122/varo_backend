import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsNumber, IsOptional, Min } from 'class-validator';
import { CreateFinancialObjectiveDto } from './create-financial-objective.dto';

export class UpdateFinancialObjectiveDto extends PartialType(
  OmitType(CreateFinancialObjectiveDto, ['type'] as const),
) {
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentAmount?: number;
}
