import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { BookingModule } from './booking/booking.module';
import { BusinessModule } from './business/business.module';
import { FavoritesModule } from './favorites/favorites.module';
import { MailModule } from './mail/mail.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    MailModule,
    AuthModule,
    BusinessModule,
    BookingModule,
    AnalyticsModule,
    MarketplaceModule,
    FavoritesModule,
    NotificationsModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
