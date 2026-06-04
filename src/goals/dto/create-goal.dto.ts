import { IsNumber, IsString, Min } from 'class-validator';

export class CreateGoalDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0.01)
  targetAmount: number;
}
