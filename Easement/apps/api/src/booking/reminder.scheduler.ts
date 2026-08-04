import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingService } from './booking.service';

@Injectable()
export class ReminderScheduler {
  private readonly logger = new Logger(ReminderScheduler.name);

  constructor(private readonly bookingService: BookingService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleDueReminders() {
    try {
      const result = await this.bookingService.processDueReminders();
      if (result.processed > 0) {
        this.logger.log(`Processed ${result.processed} reminder(s)`);
      }
    } catch (err) {
      this.logger.error('Reminder cron failed', err);
    }
  }
}
