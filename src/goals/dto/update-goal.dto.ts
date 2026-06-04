import { PartialType } from '@nestjs/mapped-types';
import { CreateGoalDto } from './create-goal.dto';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateGoalDto extends PartialType(CreateGoalDto) {
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentAmount?: number;
}
