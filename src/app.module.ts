import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ForecastModule } from './forecast/forecast.module';
import { CategoriesModule } from './categories/categories.module';
import { RecurringTransactionsModule } from './recurring-transactions/recurring-transactions.module';
import { FinancialObjectivesModule } from './financial-objectives/financial-objectives.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    TransactionsModule,
    ForecastModule,
    CategoriesModule,
    RecurringTransactionsModule,
    FinancialObjectivesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
