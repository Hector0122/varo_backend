import { IsNumber, IsOptional, IsString, Min, IsInt } from 'class-validator';

export class AddAmountDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  installments?: number;
}
