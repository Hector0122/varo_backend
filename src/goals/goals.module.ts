import { Module } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { GoalsController } from './goals.controller';
import { ForecastModule } from '../forecast/forecast.module';
import { FinancialObjectivesModule } from '../financial-objectives/financial-objectives.module';

@Module({
  imports: [ForecastModule, FinancialObjectivesModule],
  controllers: [GoalsController],
  providers: [GoalsService],
})
export class GoalsModule {}
