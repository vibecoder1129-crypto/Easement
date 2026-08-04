import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { FavoritesService } from './favorites.service';

@Controller('favorites')
@UseGuards(SessionAuthGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(@Req() req: Request) {
    return this.favorites.list(req.session.user!.userId);
  }

  @Get('ids')
  ids(@Req() req: Request) {
    return this.favorites.ids(req.session.user!.userId);
  }

  @Post(':businessId')
  add(@Param('businessId') businessId: string, @Req() req: Request) {
    return this.favorites.add(req.session.user!.userId, businessId);
  }

  @Delete(':businessId')
  remove(@Param('businessId') businessId: string, @Req() req: Request) {
    return this.favorites.remove(req.session.user!.userId, businessId);
  }
}
