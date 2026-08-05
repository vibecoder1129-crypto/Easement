import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request, Response } from 'express';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { GoogleCalendarService } from './google-calendar.service';

function webOrigin() {
  const explicit =
    process.env.WEB_ORIGIN?.trim() || process.env.FRONTEND_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const fromCors = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .find(Boolean);
  return (fromCors || 'http://localhost:3000').replace(/\/$/, '');
}

function dashboardCalendarRedirect(
  businessId: string | null,
  status: 'connected' | 'error',
  message?: string,
) {
  const params = new URLSearchParams();
  params.set('tab', 'calendar');
  if (businessId) params.set('businessId', businessId);
  params.set('googleCalendar', status);
  if (message) params.set('googleCalendarMessage', message);
  return `${webOrigin()}/dashboard?${params.toString()}`;
}

@Controller()
@UseGuards(SessionAuthGuard, RolesGuard)
export class GoogleCalendarController {
  constructor(private readonly googleCalendar: GoogleCalendarService) {}

  @Get('businesses/:businessId/google-calendar/status')
  @Roles(UserRole.business_owner, UserRole.admin)
  getStatus(
    @Param('businessId') businessId: string,
    @Req() req: Request,
  ) {
    return this.googleCalendar.getStatus(
      businessId,
      req.session.user!.userId,
    );
  }

  @Get('businesses/:businessId/google-calendar/connect')
  @Roles(UserRole.business_owner, UserRole.admin)
  connect(
    @Param('businessId') businessId: string,
    @Req() req: Request,
  ) {
    return this.googleCalendar.getConnectUrl(
      businessId,
      req.session.user!.userId,
    );
  }

  @Public()
  @Get('auth/google/calendar/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Res() res: Response,
  ) {
    if (oauthError) {
      return res.redirect(
        dashboardCalendarRedirect(
          null,
          'error',
          oauthError === 'access_denied'
            ? 'Google access was denied'
            : `Google OAuth error: ${oauthError}`,
        ),
      );
    }
    if (!code || !state) {
      return res.redirect(
        dashboardCalendarRedirect(
          null,
          'error',
          'Missing OAuth code or state',
        ),
      );
    }

    try {
      const { businessId } = await this.googleCalendar.handleOAuthCallback(
        code,
        state,
      );
      return res.redirect(dashboardCalendarRedirect(businessId, 'connected'));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to connect Google Calendar';
      return res.redirect(dashboardCalendarRedirect(null, 'error', message));
    }
  }

  @Delete('businesses/:businessId/google-calendar')
  @Roles(UserRole.business_owner, UserRole.admin)
  disconnect(
    @Param('businessId') businessId: string,
    @Req() req: Request,
  ) {
    return this.googleCalendar.disconnect(
      businessId,
      req.session.user!.userId,
    );
  }

  @Post('businesses/:businessId/google-calendar/sync-upcoming')
  @Roles(UserRole.business_owner, UserRole.admin)
  syncUpcoming(
    @Param('businessId') businessId: string,
    @Req() req: Request,
  ) {
    return this.googleCalendar.syncUpcoming(
      businessId,
      req.session.user!.userId,
    );
  }
}
