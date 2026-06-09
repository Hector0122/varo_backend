import { Module } from '@nestjs/common';
import { DebtService } from './debt.service';
import { DebtController } from './debt.controller';

@Module({
  providers: [DebtService],
  controllers: [DebtController],
})
export class DebtModule {}
