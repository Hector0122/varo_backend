import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ForecastModule } from '../forecast/forecast.module';
import { FinancialObjectivesService } from './financial-objectives.service';
import { FinancialObjectivesController } from './financial-objectives.controller';

@Module({
  imports: [PrismaModule, ForecastModule],
  controllers: [FinancialObjectivesController],
  providers: [FinancialObjectivesService],
  exports: [FinancialObjectivesService],
})
export class FinancialObjectivesModule {}
