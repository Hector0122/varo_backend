import { Module } from '@nestjs/common';
import { ForecastModule } from '../forecast/forecast.module';
import { RecurringTransactionsService } from './recurring-transactions.service';
import { RecurringTransactionsController } from './recurring-transactions.controller';

@Module({
  imports: [ForecastModule],
  controllers: [RecurringTransactionsController],
  providers: [RecurringTransactionsService],
  exports: [RecurringTransactionsService],
})
export class RecurringTransactionsModule {}
