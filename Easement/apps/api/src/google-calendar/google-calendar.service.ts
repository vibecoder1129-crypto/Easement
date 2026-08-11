import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BookingSource, BookingStatus } from '@prisma/client';
import { google } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';
import { staffDisplayName } from '../business/staff.util';
import { formatDateTimeInZone, DEFAULT_VENUE_TIMEZONE } from '../booking/timezone.util';

type SyncBooking = {
  id: string;
  startDatetime: Date;
  endDatetime: Date;
  status: BookingStatus;
  source: BookingSource;
  googleEventId: string | null;
  guestName: string | null;
  notes: string | null;
  businessId: string;
  service: { name: string };
  staff: { title: string; name: string; user: { name: string } | null };
  location: { name: string; timezone: string; address: string };
  consumer: { name: string; email: string | null } | null;
};

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(private readonly prisma: PrismaService) {}

  isConfigured() {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_REDIRECT_URI,
    );
  }

  private oauthClient() {
    if (!this.isConfigured()) {
      throw new BadRequestException(
        'Google Calendar is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.',
      );
    }
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
  }

  async getStatus(businessId: string, ownerId: string) {
    await this.assertOwner(businessId, ownerId);
    const conn = await this.prisma.googleCalendarConnection.findUnique({
      where: { businessId },
    });
    return {
      configured: this.isConfigured(),
      connected: Boolean(conn && conn.status === 'active'),
      connectedEmail: conn?.connectedEmail ?? null,
      calendarId: conn?.calendarId ?? 'primary',
      lastError: conn?.lastError ?? null,
      connectedAt: conn?.connectedAt?.toISOString() ?? null,
    };
  }

  async getConnectUrl(businessId: string, ownerId: string) {
    await this.assertOwner(businessId, ownerId);
    const client = this.oauthClient();
    const state = Buffer.from(
      JSON.stringify({ businessId, ownerId, t: Date.now() }),
    ).toString('base64url');
    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/calendar.events'],
      state,
    });
    return { url };
  }

  async handleOAuthCallback(code: string, stateRaw: string) {
    let state: { businessId: string; ownerId: string; t: number };
    try {
      state = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid OAuth state');
    }
    if (!state.businessId || !state.ownerId) {
      throw new BadRequestException('Invalid OAuth state');
    }
    // State older than 30 minutes is rejected
    if (Date.now() - state.t > 30 * 60 * 1000) {
      throw new BadRequestException('OAuth state expired. Try connecting again.');
    }

    await this.assertOwner(state.businessId, state.ownerId);

    const client = this.oauthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token && !tokens.access_token) {
      throw new BadRequestException('Google did not return tokens');
    }

    client.setCredentials(tokens);
    let connectedEmail: string | null = null;
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: client });
      const me = await oauth2.userinfo.get();
      connectedEmail = me.data.email ?? null;
    } catch {
      // email is optional for UX
    }

    const existing = await this.prisma.googleCalendarConnection.findUnique({
      where: { businessId: state.businessId },
    });

    await this.prisma.googleCalendarConnection.upsert({
      where: { businessId: state.businessId },
      create: {
        businessId: state.businessId,
        refreshToken: tokens.refresh_token ?? '',
        accessToken: tokens.access_token ?? null,
        accessTokenExpiresAt: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : null,
        calendarId: 'primary',
        connectedEmail,
        status: 'active',
        lastError: null,
      },
      update: {
        refreshToken: tokens.refresh_token ?? existing?.refreshToken ?? '',
        accessToken: tokens.access_token ?? null,
        accessTokenExpiresAt: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : null,
        connectedEmail,
        status: 'active',
        lastError: null,
      },
    });

    return { businessId: state.businessId };
  }

  async disconnect(businessId: string, ownerId: string) {
    await this.assertOwner(businessId, ownerId);
    await this.prisma.googleCalendarConnection.deleteMany({
      where: { businessId },
    });
    return { success: true };
  }

  /** Non-blocking push after booking lifecycle changes. */
  async syncBookingSafe(bookingId: string) {
    try {
      await this.syncBooking(bookingId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Google sync failed for booking ${bookingId}: ${message}`,
      );
      try {
        const booking = await this.prisma.booking.findUnique({
          where: { id: bookingId },
          select: { businessId: true },
        });
        if (booking) {
          await this.prisma.googleCalendarConnection.updateMany({
            where: { businessId: booking.businessId, status: 'active' },
            data: { lastError: message.slice(0, 500) },
          });
        }
      } catch {
        // ignore persistence failures for lastError
      }
    }
  }

  async syncBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: { select: { name: true } },
        staff: { include: { user: { select: { name: true } } } },
        location: { select: { name: true, timezone: true, address: true } },
        consumer: { select: { name: true, email: true } },
      },
    });
    if (!booking) return;

    const conn = await this.prisma.googleCalendarConnection.findUnique({
      where: { businessId: booking.businessId },
    });
    if (!conn || conn.status !== 'active' || !conn.refreshToken) {
      return;
    }

    const auth = await this.authedClient(conn);
    const calendar = google.calendar({ version: 'v3', auth });
    const calendarId = conn.calendarId || 'primary';

    const terminal =
      booking.status === BookingStatus.cancelled ||
      booking.status === BookingStatus.no_show;

    if (terminal) {
      if (booking.googleEventId) {
        try {
          await calendar.events.delete({
            calendarId,
            eventId: booking.googleEventId,
          });
        } catch (err) {
          this.logger.warn(`Failed to delete Google event: ${String(err)}`);
        }
        await this.prisma.booking.update({
          where: { id: booking.id },
          data: { googleEventId: null },
        });
      }
      await this.clearError(conn.id);
      return;
    }

    const event = this.toGoogleEvent(booking as SyncBooking);

    if (booking.googleEventId) {
      try {
        await calendar.events.patch({
          calendarId,
          eventId: booking.googleEventId,
          requestBody: event,
        });
        await this.clearError(conn.id);
        return;
      } catch (err) {
        this.logger.warn(`Patch failed, creating new event: ${String(err)}`);
      }
    }

    const created = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });
    await this.prisma.booking.update({
      where: { id: booking.id },
      data: { googleEventId: created.data.id ?? null },
    });
    await this.clearError(conn.id);
  }

  async syncUpcoming(businessId: string, ownerId: string) {
    await this.assertOwner(businessId, ownerId);
    const conn = await this.prisma.googleCalendarConnection.findUnique({
      where: { businessId },
    });
    if (!conn || conn.status !== 'active') {
      throw new BadRequestException('Connect Google Calendar first');
    }

    const upcoming = await this.prisma.booking.findMany({
      where: {
        businessId,
        status: { in: [BookingStatus.confirmed, BookingStatus.pending] },
        startDatetime: { gte: new Date() },
      },
      select: { id: true },
      take: 100,
      orderBy: { startDatetime: 'asc' },
    });

    let synced = 0;
    let failed = 0;
    for (const b of upcoming) {
      try {
        await this.syncBooking(b.id);
        synced += 1;
      } catch {
        failed += 1;
      }
    }
    return { synced, failed, total: upcoming.length };
  }

  private toGoogleEvent(booking: SyncBooking) {
    const clientName =
      booking.consumer?.name ?? booking.guestName ?? 'Client';
    const staffName = staffDisplayName({
      name: booking.staff.name,
      user: booking.staff.user,
    });
    const sourceLabel =
      booking.source === BookingSource.owner
        ? 'Walk-in (Easement)'
        : 'Marketplace (Easement)';
    const timeZone = booking.location.timezone || DEFAULT_VENUE_TIMEZONE;
    const when = formatDateTimeInZone(booking.startDatetime, timeZone);

    return {
      summary: `${booking.service.name} — ${clientName}`,
      description: [
        `Service: ${booking.service.name}`,
        `Staff: ${staffName}`,
        `Client: ${clientName}`,
        booking.consumer?.email || booking.guestName
          ? `Contact: ${booking.consumer?.email ?? ''}`.trim()
          : null,
        `When (venue): ${when} (${timeZone})`,
        `Source: ${sourceLabel}`,
        booking.notes ? `Notes: ${booking.notes}` : null,
        'Managed in Easement — pay at the venue.',
      ]
        .filter(Boolean)
        .join('\n'),
      location: booking.location.address || booking.location.name,
      start: {
        dateTime: booking.startDatetime.toISOString(),
        timeZone,
      },
      end: {
        dateTime: booking.endDatetime.toISOString(),
        timeZone,
      },
    };
  }

  private async authedClient(conn: {
    id: string;
    refreshToken: string;
    accessToken: string | null;
    accessTokenExpiresAt: Date | null;
  }) {
    const client = this.oauthClient();
    client.setCredentials({
      refresh_token: conn.refreshToken,
      access_token: conn.accessToken ?? undefined,
      expiry_date: conn.accessTokenExpiresAt?.getTime(),
    });
    client.on('tokens', async (tokens) => {
      try {
        await this.prisma.googleCalendarConnection.update({
          where: { id: conn.id },
          data: {
            accessToken: tokens.access_token ?? undefined,
            accessTokenExpiresAt: tokens.expiry_date
              ? new Date(tokens.expiry_date)
              : undefined,
            refreshToken: tokens.refresh_token ?? undefined,
          },
        });
      } catch (err) {
        this.logger.warn(`Failed to persist refreshed tokens: ${String(err)}`);
      }
    });
    return client;
  }

  private async clearError(connectionId: string) {
    await this.prisma.googleCalendarConnection.update({
      where: { id: connectionId },
      data: { lastError: null },
    });
  }

  private async assertOwner(businessId: string, ownerId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });
    if (!business) throw new NotFoundException('Business not found');
    if (business.ownerId !== ownerId) {
      throw new ForbiddenException('Not allowed');
    }
  }
}
