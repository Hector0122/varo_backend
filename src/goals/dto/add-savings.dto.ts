import { IsNumber, Min } from 'class-validator';

export class AddSavingsDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;
}
