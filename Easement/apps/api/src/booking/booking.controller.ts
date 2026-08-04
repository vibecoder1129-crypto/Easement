import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CronOrAdminGuard } from '../auth/cron-or-admin.guard';
import { Public } from '../auth/public.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { BookingService } from './booking.service';
import {
  CompleteBookingDto,
  CreateBookingDto,
  CreateReviewDto,
  GetSlotsDto,
  RescheduleBookingDto,
} from './dto/booking.dto';

@Controller('bookings')
@UseGuards(SessionAuthGuard, RolesGuard)
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Get('slots')
  getSlots(@Query() query: GetSlotsDto) {
    return this.bookingService.getAvailableSlots(query);
  }

  @Post()
  createBooking(@Body() dto: CreateBookingDto, @Req() req: Request) {
    return this.bookingService.createBooking(req.session.user!.userId, dto);
  }

  @Get('my')
  getConsumerBookings(@Req() req: Request) {
    return this.bookingService.getConsumerBookings(req.session.user!.userId);
  }

  @Public()
  @UseGuards(CronOrAdminGuard)
  @Post('reminders/process')
  processReminders() {
    return this.bookingService.processDueReminders();
  }

  @Get('business/:businessId')
  getBusinessBookings(
    @Param('businessId') businessId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('staffId') staffId: string,
    @Req() req: Request,
  ) {
    return this.bookingService.getBusinessBookings(
      businessId,
      req.session.user!.userId,
      req.session.user!.role,
      startDate,
      endDate,
      staffId,
    );
  }

  @Patch(':id/cancel')
  cancelBooking(@Param('id') id: string, @Req() req: Request) {
    return this.bookingService.cancelBooking(
      id,
      req.session.user!.userId,
      req.session.user!.role,
    );
  }

  @Patch(':id/reschedule')
  rescheduleBooking(
    @Param('id') id: string,
    @Body() dto: RescheduleBookingDto,
    @Req() req: Request,
  ) {
    return this.bookingService.rescheduleBooking(
      id,
      req.session.user!.userId,
      dto,
    );
  }

  @Post(':id/complete')
  completeBooking(
    @Param('id') id: string,
    @Body() dto: CompleteBookingDto,
    @Req() req: Request,
  ) {
    return this.bookingService.completeBooking(
      id,
      req.session.user!.userId,
      dto,
    );
  }

  @Post(':id/review')
  createReview(
    @Param('id') id: string,
    @Body() dto: CreateReviewDto,
    @Req() req: Request,
  ) {
    return this.bookingService.createReview(
      id,
      req.session.user!.userId,
      dto,
    );
  }
}
