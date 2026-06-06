import { IsIn, IsString } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsIn(['INCOME', 'EXPENSE', 'BOTH'])
  type: string;
}
