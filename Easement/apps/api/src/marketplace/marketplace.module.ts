import { Module } from '@nestjs/common';
import { BookingModule } from '../booking/booking.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

@Module({
  imports: [PrismaModule, BookingModule],
  controllers: [MarketplaceController],
  providers: [MarketplaceService],
})
export class MarketplaceModule {}
