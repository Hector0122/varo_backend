import { Controller, Delete, Req } from '@nestjs/common';
import { RequestWithUser } from '../types/request-with-user';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Delete('me/data')
  deleteAllData(@Req() req: RequestWithUser) {
    return this.usersService.deleteAllData(req.user.id);
  }
}
