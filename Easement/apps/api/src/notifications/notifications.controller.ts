import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(SessionAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Req() req: Request) {
    return this.notifications.listForUser(req.session.user!.userId);
  }

  @Get('unread-count')
  unreadCount(@Req() req: Request) {
    return this.notifications.unreadCount(req.session.user!.userId);
  }

  @Patch('read-all')
  markAllRead(@Req() req: Request) {
    return this.notifications.markAllRead(req.session.user!.userId);
  }

  @Delete()
  clearAll(@Req() req: Request) {
    return this.notifications.clearAll(req.session.user!.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.notifications.remove(req.session.user!.userId, id);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @Req() req: Request) {
    return this.notifications.markRead(req.session.user!.userId, id);
  }
}
