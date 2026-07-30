import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FinancialObjectivesService } from './financial-objectives.service';

@Module({
  imports: [PrismaModule],
  providers: [FinancialObjectivesService],
  exports: [FinancialObjectivesService],
})
export class FinancialObjectivesModule {}
