import { Controller, Get, Param, Query } from '@nestjs/common';
import { GetSlotsDto } from '../booking/dto/booking.dto';
import { BookingService } from '../booking/booking.service';
import { MarketplaceService } from './marketplace.service';

@Controller('public')
export class MarketplaceController {
  constructor(
    private readonly marketplace: MarketplaceService,
    private readonly bookings: BookingService,
  ) {}

  @Get('businesses')
  listBusinesses(
    @Query('category') category?: string,
    @Query('q') q?: string,
    @Query('area') area?: string,
  ) {
    return this.marketplace.listBusinesses(category, q, area);
  }

  @Get('businesses/:id')
  getBusiness(@Param('id') id: string) {
    return this.marketplace.getPublicBusiness(id);
  }

  @Get('slots')
  getSlots(@Query() query: GetSlotsDto) {
    return this.bookings.getAvailableSlots(query);
  }
}
