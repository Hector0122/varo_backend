import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { GoalsService } from './goals.service';

@UseGuards(JwtAuthGuard)
@Controller('goals')
export class GoalsController {
  constructor(private goalsService: GoalsService) {}

  @Get()
  findAll(@Request() req) {
    return this.goalsService.findAll(req.user.id);
  }

  @Post()
  create(@Request() req, @Body() dto: CreateGoalDto) {
    return this.goalsService.create(req.user.id, dto);
  }

  @Patch(':id')
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.goalsService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.goalsService.remove(id, req.user.id);
  }
}
