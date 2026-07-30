import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { ForecastService } from './forecast.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequestWithUser } from '../types/request-with-user';

@Controller('forecast')
@UseGuards(JwtAuthGuard)
export class ForecastController {
  constructor(private forecastService: ForecastService) {}

  @Get(':goalId')
  async getForecast(
    @Param('goalId') goalId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.forecastService.computeForecast(goalId, req.user.id);
  }
}
