import { Module } from '@nestjs/common';
import { DebtService } from './debt.service';
import { DebtController } from './debt.controller';
import { ForecastModule } from '../forecast/forecast.module';
import { FinancialObjectivesModule } from '../financial-objectives/financial-objectives.module';

@Module({
  imports: [ForecastModule, FinancialObjectivesModule],
  providers: [DebtService],
  controllers: [DebtController],
})
export class DebtModule {}
