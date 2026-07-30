import { Module } from '@nestjs/common';
import { DebtService } from './debt.service';
import { DebtController } from './debt.controller';
import { ForecastModule } from '../forecast/forecast.module';

@Module({
  imports: [ForecastModule],
  providers: [DebtService],
  controllers: [DebtController],
})
export class DebtModule {}
