import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['INCOME', 'EXPENSE', 'BOTH'])
  type?: string;
}
