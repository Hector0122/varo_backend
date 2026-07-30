import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const ENTRY_TYPES = ['ADD', 'WITHDRAW', 'PAYMENT', 'INCREASE'] as const;
export type ObjectiveEntryType = (typeof ENTRY_TYPES)[number];

export class CreateObjectiveEntryDto {
  @IsIn(ENTRY_TYPES)
  type!: ObjectiveEntryType;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  installments?: number;

  @IsOptional()
  @IsDateString()
  date?: string;
}
