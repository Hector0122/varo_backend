import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { ForecastService } from './forecast.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('forecast')
@UseGuards(JwtAuthGuard)
export class ForecastController {
  constructor(private forecastService: ForecastService) {}

  @Get(':goalId')
  async getForecast(@Param('goalId') goalId: string, @Request() req) {
    return this.forecastService.computeForecast(goalId, req.user.id);
  }

  @Get(':goalId/history')
  async getHistory(@Param('goalId') goalId: string, @Request() req) {
    return this.forecastService.getSnapshots(goalId, req.user.id);
  }
}
