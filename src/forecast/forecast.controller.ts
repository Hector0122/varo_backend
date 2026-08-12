import { Controller, Get, Param, Req } from '@nestjs/common';
import { ForecastService } from './forecast.service';
import { RequestWithUser } from '../types/request-with-user';

@Controller('forecast')
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
