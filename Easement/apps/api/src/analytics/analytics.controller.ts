import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AnalyticsService } from './analytics.service';
import { UserRole } from '@prisma/client';

@Controller('analytics')
@UseGuards(SessionAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('business/:businessId')
  @Roles(UserRole.business_owner, UserRole.admin)
  getBusinessAnalytics(
    @Param('businessId') businessId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: Request,
  ) {
    return this.analyticsService.getBusinessAnalytics(
      businessId,
      req.session.user!.userId,
      req.session.user!.role,
      startDate,
      endDate,
    );
  }
}
