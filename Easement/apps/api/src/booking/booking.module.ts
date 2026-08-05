import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GoogleCalendarModule } from '../google-calendar/google-calendar.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { ReminderScheduler } from './reminder.scheduler';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    AuthModule,
    forwardRef(() => GoogleCalendarModule),
  ],
  controllers: [BookingController],
  providers: [BookingService, ReminderScheduler],
  exports: [BookingService],
})
export class BookingModule {}
