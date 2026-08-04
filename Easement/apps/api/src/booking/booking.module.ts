import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { ReminderScheduler } from './reminder.scheduler';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [BookingController],
  providers: [BookingService, ReminderScheduler],
  exports: [BookingService],
})
export class BookingModule {}
