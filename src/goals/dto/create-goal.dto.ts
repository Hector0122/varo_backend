import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateGoalDto {
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
}
