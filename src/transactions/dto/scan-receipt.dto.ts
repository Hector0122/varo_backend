import { IsString } from 'class-validator';

export class ScanReceiptDto {
  @IsString()
  image!: string;
}
