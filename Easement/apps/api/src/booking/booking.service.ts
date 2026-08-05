import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  BookingSource,
  BookingStatus,
  BusinessStatus,
  NotificationType,
  PaymentMethod,
  Prisma,
  UserRole,
} from '@prisma/client';
import { staffDisplayName } from '../business/staff.util';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  bookingAbuseLimits,
  maxAdvanceMs,
} from './booking-abuse.util';
import { SLOT_BLOCKING_STATUSES } from './booking-status.util';
import {
  formatDateTimeInZone,
  formatHmInZone,
  getZonedParts,
  zonedWallTimeToUtc,
  DEFAULT_VENUE_TIMEZONE,
} from './timezone.util';
import {
  CompleteBookingDto,
  CreateBookingDto,
  CreateOwnerBookingDto,
  CreateReviewDto,
  GetSlotsDto,
  UpdateOwnerBookingDto,
} from './dto/booking.dto';

function isExclusionConflict(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('exclusion') ||
    msg.includes('conflicting key value') ||
    msg.includes('23P01')
  );
}

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    @Inject(forwardRef(() => GoogleCalendarService))
    private readonly googleCalendar: GoogleCalendarService,
  ) {}

  async getAvailableSlots(dto: GetSlotsDto) {
    const { businessId, serviceId, date, staffId } = dto;

    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, businessId },
      include: {
        staff: {
          include: {
            staff: {
              include: { user: { select: { name: true } } },
            },
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const primaryLocation = await this.prisma.location.findFirst({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, timezone: true },
    });

    // Prefer explicit location, else staff home location, else primary business location.
    let timeZone = primaryLocation?.timezone || DEFAULT_VENUE_TIMEZONE;
    if (dto.locationId) {
      const loc = await this.prisma.location.findFirst({
        where: { id: dto.locationId, businessId },
        select: { timezone: true },
      });
      if (!loc) {
        throw new BadRequestException('Location does not belong to this business');
      }
      timeZone = loc.timezone || DEFAULT_VENUE_TIMEZONE;
    } else if (staffId) {
      const staffLoc = await this.prisma.staff.findFirst({
        where: { id: staffId, businessId },
        include: { location: { select: { timezone: true } } },
      });
      if (staffLoc?.location?.timezone) {
        timeZone = staffLoc.location.timezone;
      }
    }

    // Determine target staff members
    let candidateStaff = service.staff.map((st) => st.staff);
    if (candidateStaff.length === 0) {
      const allStaff = await this.prisma.staff.findMany({
        where: { businessId },
        include: { user: { select: { name: true } } },
      });
      candidateStaff = allStaff;
    }

    if (staffId) {
      candidateStaff = candidateStaff.filter((s) => s.id === staffId);
    }

    if (candidateStaff.length === 0) {
      return { date, serviceId, slots: [], timeZone };
    }

    const [year, month, day] = date.split('-').map(Number);
    if (!year || !month || !day) {
      throw new BadRequestException('Invalid date');
    }

    // Day-of-week for this calendar date in the venue timezone (noon wall time).
    const noonLocal = zonedWallTimeToUtc(year, month, day, 12, 0, timeZone);
    const dayOfWeek = getZonedParts(noonLocal, timeZone).dayOfWeek;

    const slots: {
      time: string;
      startDatetime: string;
      endDatetime: string;
      staffId: string;
      staffName: string;
    }[] = [];

    const durationMs = service.durationMinutes * 60 * 1000;
    const intervalMs = 15 * 60 * 1000;
    const nowMs = Date.now();

    for (const staff of candidateStaff) {
      const availability = await this.prisma.availability.findFirst({
        where: { staffId: staff.id, dayOfWeek },
      });

      if (!availability) {
        continue;
      }

      const [startH, startM] = availability.startTime.split(':').map(Number);
      const [endH, endM] = availability.endTime.split(':').map(Number);

      const dayStart = zonedWallTimeToUtc(
        year,
        month,
        day,
        startH,
        startM,
        timeZone,
      );
      const dayEnd = zonedWallTimeToUtc(year, month, day, endH, endM, timeZone);
      const dayStartMs = dayStart.getTime();
      const dayEndMs = dayEnd.getTime();

      const timeOffs = await this.prisma.timeOff.findMany({
        where: {
          staffId: staff.id,
          startDatetime: { lte: dayEnd },
          endDatetime: { gte: dayStart },
        },
      });

      const existingBookings = await this.prisma.booking.findMany({
        where: {
          staffId: staff.id,
          status: { in: SLOT_BLOCKING_STATUSES },
          startDatetime: { lte: dayEnd },
          endDatetime: { gte: dayStart },
        },
      });

      for (
        let slotStartMs = dayStartMs;
        slotStartMs + durationMs <= dayEndMs;
        slotStartMs += intervalMs
      ) {
        // Never offer slots that already started (or start now).
        if (slotStartMs <= nowMs) {
          continue;
        }

        const slotEndMs = slotStartMs + durationMs;

        const isTimeOff = timeOffs.some(
          (to) =>
            slotStartMs < to.endDatetime.getTime() &&
            slotEndMs > to.startDatetime.getTime(),
        );
        if (isTimeOff) continue;

        const isBooked = existingBookings.some(
          (b) =>
            slotStartMs < b.endDatetime.getTime() &&
            slotEndMs > b.startDatetime.getTime(),
        );
        if (isBooked) continue;

        const slotStartDate = new Date(slotStartMs);
        const slotEndDate = new Date(slotEndMs);

        slots.push({
          time: formatHmInZone(slotStartDate, timeZone),
          startDatetime: slotStartDate.toISOString(),
          endDatetime: slotEndDate.toISOString(),
          staffId: staff.id,
          staffName: staffDisplayName(staff),
        });
      }
    }

    return {
      date,
      serviceId,
      serviceName: service.name,
      price: service.price,
      durationMinutes: service.durationMinutes,
      timeZone,
      slots,
    };
  }

  async createBooking(consumerId: string, dto: CreateBookingDto) {
    const { businessId, locationId, serviceId, staffId, startDatetime, notes } = dto;

    const start = new Date(startDatetime);
    if (isNaN(start.getTime())) {
      throw new BadRequestException('Invalid startDatetime');
    }
    if (start.getTime() <= Date.now()) {
      throw new BadRequestException(
        'That time slot is already in the past. Pick a future time.',
      );
    }

    const limits = bookingAbuseLimits();
    const advanceLimit = Date.now() + maxAdvanceMs(limits.maxAdvanceDays);
    if (start.getTime() > advanceLimit) {
      throw new BadRequestException(
        `You can only book up to ${limits.maxAdvanceDays} days ahead.`,
      );
    }

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const createsLastHour = await this.prisma.booking.count({
      where: {
        consumerId,
        createdAt: { gte: hourAgo },
      },
    });
    if (createsLastHour >= limits.maxCreatesPerHour) {
      throw new BadRequestException(
        'Too many bookings created recently. Please try again later.',
      );
    }

    const upcomingWhere = {
      consumerId,
      status: {
        in: [BookingStatus.confirmed, BookingStatus.pending],
      },
      startDatetime: { gt: new Date() },
    };
    const upcomingTotal = await this.prisma.booking.count({
      where: upcomingWhere,
    });
    if (upcomingTotal >= limits.maxUpcoming) {
      throw new BadRequestException(
        `You already have ${limits.maxUpcoming} upcoming appointments. Cancel or finish one before booking more.`,
      );
    }

    const upcomingAtBusiness = await this.prisma.booking.count({
      where: {
        ...upcomingWhere,
        businessId,
      },
    });
    if (upcomingAtBusiness >= limits.maxUpcomingPerBusiness) {
      throw new BadRequestException(
        `You already have ${limits.maxUpcomingPerBusiness} upcoming appointments at this venue.`,
      );
    }

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { status: true },
    });
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    if (business.status !== BusinessStatus.approved) {
      throw new BadRequestException(
        'This business is not yet approved for bookings',
      );
    }

    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, businessId },
    });
    if (!service) {
      throw new NotFoundException('Service not found for this business');
    }

    const location = await this.prisma.location.findFirst({
      where: { id: locationId, businessId },
      select: { id: true, timezone: true },
    });
    if (!location) {
      throw new BadRequestException('Location does not belong to this business');
    }

    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, businessId },
      select: { id: true },
    });
    if (!staff) {
      throw new BadRequestException('Staff does not belong to this business');
    }

    const assignedCount = await this.prisma.staffService.count({
      where: { serviceId },
    });
    if (assignedCount > 0) {
      const assigned = await this.prisma.staffService.findFirst({
        where: { serviceId, staffId },
      });
      if (!assigned) {
        throw new BadRequestException(
          'This staff member is not assigned to that service',
        );
      }
    }

    const end = new Date(start.getTime() + service.durationMinutes * 60 * 1000);
    const timeZone = location.timezone || DEFAULT_VENUE_TIMEZONE;
    const startParts = getZonedParts(start, timeZone);
    const endParts = getZonedParts(end, timeZone);
    const availability = await this.prisma.availability.findFirst({
      where: { staffId, dayOfWeek: startParts.dayOfWeek },
    });
    if (!availability) {
      throw new BadRequestException('Staff is not available on that day');
    }
    const [availStartH, availStartM] = availability.startTime
      .split(':')
      .map(Number);
    const [availEndH, availEndM] = availability.endTime.split(':').map(Number);
    const startMinutes = startParts.hour * 60 + startParts.minute;
    const endMinutes = endParts.hour * 60 + endParts.minute;
    const availStartMinutes = availStartH * 60 + availStartM;
    const availEndMinutes = availEndH * 60 + availEndM;
    if (
      startParts.year !== endParts.year ||
      startParts.month !== endParts.month ||
      startParts.day !== endParts.day ||
      startMinutes < availStartMinutes ||
      endMinutes > availEndMinutes
    ) {
      throw new BadRequestException(
        'That time is outside the staff working hours',
      );
    }

    let result: {
      bookingId: string;
      status: BookingStatus;
      startDatetime: string;
      endDatetime: string;
      price: number;
      notes: string | null;
      reminderAt: string | null;
      businessName: string;
      locationName: string;
      serviceName: string;
      staffName: string;
      clientName: string;
      clientEmail: string;
    };

    try {
      result = await this.prisma.$transaction(async (tx) => {
        const conflict = await tx.booking.findFirst({
          where: {
            staffId,
            status: { in: SLOT_BLOCKING_STATUSES },
            startDatetime: { lt: end },
            endDatetime: { gt: start },
          },
        });

        if (conflict) {
          throw new ConflictException(
            'This time slot has already been booked by another client',
          );
        }

        const timeOff = await tx.timeOff.findFirst({
          where: {
            staffId,
            startDatetime: { lt: end },
            endDatetime: { gt: start },
          },
        });

        if (timeOff) {
          throw new ConflictException('Staff member is on time off at this time');
        }

        const consumer = await tx.user.findUnique({
          where: { id: consumerId },
          select: { remindersEnabled: true },
        });

        const reminderAt =
          consumer?.remindersEnabled === false
            ? null
            : new Date(start.getTime() - 24 * 60 * 60 * 1000);

        const booking = await tx.booking.create({
          data: {
            consumerId,
            businessId,
            locationId,
            serviceId,
            staffId,
            startDatetime: start,
            endDatetime: end,
            price: service.price,
            status: BookingStatus.confirmed,
            source: BookingSource.marketplace,
            notes,
            reminderAt:
              reminderAt && reminderAt.getTime() > Date.now() ? reminderAt : null,
          },
          include: {
            business: { select: { name: true } },
            location: { select: { name: true, address: true } },
            service: { select: { name: true, durationMinutes: true } },
            staff: { include: { user: { select: { name: true } } } },
            consumer: { select: { name: true, email: true, phone: true } },
          },
        });

        return {
          bookingId: booking.id,
          status: booking.status,
          startDatetime: booking.startDatetime.toISOString(),
          endDatetime: booking.endDatetime.toISOString(),
          price: booking.price,
          notes: booking.notes,
          reminderAt: booking.reminderAt?.toISOString() ?? null,
          businessName: booking.business.name,
          locationName: booking.location.name,
          serviceName: booking.service.name,
          staffName: staffDisplayName(booking.staff),
          clientName: booking.consumer!.name,
          clientEmail: booking.consumer!.email,
        };
      });
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      if (isExclusionConflict(err)) {
        throw new ConflictException(
          'This time slot has already been booked by another client',
        );
      }
      throw err;
    }

    const whenVenue = formatDateTimeInZone(
      new Date(result.startDatetime),
      timeZone,
    );
    const confirmBody = `${result.serviceName} at ${result.businessName} with ${result.staffName} on ${whenVenue} (${timeZone}). Pay at the venue.`;

    await this.notifications.create({
      userId: consumerId,
      type: NotificationType.booking_confirmed,
      title: 'Appointment confirmed',
      body: confirmBody,
        href: '/notifications',
        bookingId: result.bookingId,
      });

    await this.mail
      .send({
        to: result.clientEmail,
        subject: `Appointment confirmed — ${result.serviceName}`,
        text: `Hi ${result.clientName},\n\n${confirmBody}\n\nSee your bookings: /notifications\n\n— Easement`,
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Confirmation email failed', err);
      });

    void this.googleCalendar.syncBookingSafe(result.bookingId);

    return { ...result, timeZone };
  }

  async getConsumerBookings(consumerId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: { consumerId },
      include: {
        business: { select: { id: true, name: true, category: true } },
        location: { select: { name: true, address: true, timezone: true } },
        service: { select: { name: true, durationMinutes: true } },
        staff: { include: { user: { select: { name: true } } } },
        review: true,
      },
      orderBy: { startDatetime: 'desc' },
    });

    return bookings.map((b) => ({
      bookingId: b.id,
      status: b.status,
      startDatetime: b.startDatetime.toISOString(),
      endDatetime: b.endDatetime.toISOString(),
      price: b.price,
      businessId: b.business.id,
      businessName: b.business.name,
      businessCategory: b.business.category,
      locationName: b.location.name,
      timezone: b.location.timezone,
      serviceId: b.serviceId,
      serviceName: b.service.name,
      staffId: b.staffId,
      staffName: staffDisplayName(b.staff),
      hasReview: !!b.review,
      reviewRating: b.review?.rating,
      reminderAt: b.reminderAt?.toISOString() ?? null,
      reminderSentAt: b.reminderSentAt?.toISOString() ?? null,
    }));
  }

  async getBusinessBookings(
    businessId: string,
    userId: string,
    userRole: string,
    startDate?: string,
    endDate?: string,
    staffId?: string,
  ) {
    if (userRole !== UserRole.admin) {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
      });
      if (!business) throw new NotFoundException('Business not found');
      if (business.ownerId !== userId) {
        throw new ForbiddenException('Not allowed to access this business bookings');
      }
    }

    const whereClause: any = { businessId };

    if (startDate || endDate) {
      whereClause.startDatetime = {};
      if (startDate) whereClause.startDatetime.gte = new Date(startDate);
      if (endDate) whereClause.startDatetime.lte = new Date(endDate);
    }

    if (staffId) {
      whereClause.staffId = staffId;
    }

    const bookings = await this.prisma.booking.findMany({
      where: whereClause,
      include: {
        consumer: { select: { id: true, name: true, email: true, phone: true } },
        service: { select: { id: true, name: true, durationMinutes: true } },
        staff: { include: { user: { select: { name: true } } } },
        location: { select: { id: true, name: true, timezone: true } },
        sale: true,
      },
      orderBy: { startDatetime: 'asc' },
    });

    return bookings.map((b) => ({
      bookingId: b.id,
      status: b.status,
      source: b.source,
      startDatetime: b.startDatetime.toISOString(),
      endDatetime: b.endDatetime.toISOString(),
      price: b.price,
      notes: b.notes,
      client: {
        id: b.consumer?.id ?? null,
        name: b.consumer?.name ?? b.guestName ?? 'Walk-in guest',
        email: b.consumer?.email ?? b.guestEmail ?? '',
        phone: b.consumer?.phone ?? b.guestPhone ?? undefined,
      },
      service: {
        id: b.service.id,
        name: b.service.name,
        durationMinutes: b.service.durationMinutes,
      },
      staff: {
        id: b.staff.id,
        name: staffDisplayName(b.staff),
      },
      location: {
        id: b.location.id,
        name: b.location.name,
        timezone: b.location.timezone,
      },
      timezone: b.location.timezone,
      sale: b.sale
        ? {
            saleId: b.sale.id,
            total: b.sale.total,
            paymentMethod: b.sale.paymentMethod,
            soldAt: b.sale.soldAt.toISOString(),
          }
        : null,
    }));
  }

  async createOwnerBooking(
    businessId: string,
    ownerId: string,
    dto: CreateOwnerBookingDto,
  ) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerId: true, status: true, name: true },
    });
    if (!business) throw new NotFoundException('Business not found');
    if (business.ownerId !== ownerId) {
      throw new ForbiddenException('Not allowed to create bookings for this business');
    }
    if (business.status !== BusinessStatus.approved) {
      throw new BadRequestException('Business must be approved to take bookings');
    }

    const start = new Date(dto.startDatetime);
    if (isNaN(start.getTime())) {
      throw new BadRequestException('Invalid startDatetime');
    }

    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, businessId },
    });
    if (!service) {
      throw new NotFoundException('Service not found for this business');
    }

    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, businessId },
      select: { id: true, timezone: true },
    });
    if (!location) {
      throw new BadRequestException('Location does not belong to this business');
    }

    const staff = await this.prisma.staff.findFirst({
      where: { id: dto.staffId, businessId },
      select: { id: true },
    });
    if (!staff) {
      throw new BadRequestException('Staff does not belong to this business');
    }

    const assignedCount = await this.prisma.staffService.count({
      where: { serviceId: dto.serviceId },
    });
    if (assignedCount > 0) {
      const assigned = await this.prisma.staffService.findFirst({
        where: { serviceId: dto.serviceId, staffId: dto.staffId },
      });
      if (!assigned) {
        throw new BadRequestException(
          'This staff member is not assigned to that service',
        );
      }
    }

    const end = new Date(start.getTime() + service.durationMinutes * 60 * 1000);
    const timeZone = location.timezone || DEFAULT_VENUE_TIMEZONE;
    await this.assertStaffAvailable(dto.staffId, start, end, timeZone);

    try {
      const booking = await this.prisma.$transaction(async (tx) => {
        await this.assertNoConflict(tx, dto.staffId, start, end);

        return tx.booking.create({
          data: {
            consumerId: null,
            businessId,
            locationId: dto.locationId,
            serviceId: dto.serviceId,
            staffId: dto.staffId,
            startDatetime: start,
            endDatetime: end,
            price: service.price,
            status: BookingStatus.confirmed,
            source: BookingSource.owner,
            guestName: dto.guestName.trim(),
            guestEmail: dto.guestEmail?.trim() || null,
            guestPhone: dto.guestPhone?.trim() || null,
            notes: dto.notes?.trim() || null,
            reminderAt: null,
          },
          include: {
            service: { select: { name: true } },
            staff: { include: { user: { select: { name: true } } } },
            location: { select: { timezone: true } },
          },
        });
      });

      void this.googleCalendar.syncBookingSafe(booking.id);

      return {
        bookingId: booking.id,
        status: booking.status,
        source: booking.source,
        startDatetime: booking.startDatetime.toISOString(),
        endDatetime: booking.endDatetime.toISOString(),
        price: booking.price,
        client: {
          name: booking.guestName ?? 'Walk-in guest',
          email: booking.guestEmail ?? '',
          phone: booking.guestPhone ?? undefined,
        },
        service: { name: booking.service.name },
        staff: { id: booking.staffId, name: staffDisplayName(booking.staff) },
        timezone: booking.location.timezone,
      };
    } catch (err) {
      if (err instanceof ConflictException || err instanceof BadRequestException) {
        throw err;
      }
      if (isExclusionConflict(err)) {
        throw new ConflictException('This time slot is already booked');
      }
      throw err;
    }
  }

  async updateOwnerBooking(
    bookingId: string,
    ownerId: string,
    dto: UpdateOwnerBookingDto,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        business: { select: { ownerId: true } },
        service: true,
        location: { select: { id: true, timezone: true, businessId: true } },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.business.ownerId !== ownerId) {
      throw new ForbiddenException('Not allowed to edit this booking');
    }
    if (
      booking.status === BookingStatus.cancelled ||
      booking.status === BookingStatus.completed ||
      booking.status === BookingStatus.no_show
    ) {
      throw new BadRequestException(
        `Cannot edit a booking with status "${booking.status}"`,
      );
    }

    const staffId = dto.staffId ?? booking.staffId;
    const serviceId = dto.serviceId ?? booking.serviceId;
    const start = dto.startDatetime
      ? new Date(dto.startDatetime)
      : booking.startDatetime;
    if (isNaN(start.getTime())) {
      throw new BadRequestException('Invalid startDatetime');
    }

    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, businessId: booking.businessId },
    });
    if (!service) throw new NotFoundException('Service not found');

    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, businessId: booking.businessId },
    });
    if (!staff) throw new BadRequestException('Staff does not belong to this business');

    const end = new Date(start.getTime() + service.durationMinutes * 60 * 1000);
    const timeZone = booking.location.timezone || DEFAULT_VENUE_TIMEZONE;
    await this.assertStaffAvailable(staffId, start, end, timeZone);

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await this.assertNoConflict(tx, staffId, start, end, bookingId);

        return tx.booking.update({
          where: { id: bookingId },
          data: {
            staffId,
            serviceId,
            startDatetime: start,
            endDatetime: end,
            price: service.price,
            guestName:
              dto.guestName !== undefined
                ? dto.guestName.trim()
                : booking.guestName,
            guestEmail:
              dto.guestEmail !== undefined
                ? dto.guestEmail.trim() || null
                : booking.guestEmail,
            guestPhone:
              dto.guestPhone !== undefined
                ? dto.guestPhone.trim() || null
                : booking.guestPhone,
            notes:
              dto.notes !== undefined ? dto.notes.trim() || null : booking.notes,
          },
        });
      });

      void this.googleCalendar.syncBookingSafe(updated.id);

      return {
        bookingId: updated.id,
        status: updated.status,
        startDatetime: updated.startDatetime.toISOString(),
        endDatetime: updated.endDatetime.toISOString(),
      };
    } catch (err) {
      if (err instanceof ConflictException || err instanceof BadRequestException) {
        throw err;
      }
      if (isExclusionConflict(err)) {
        throw new ConflictException('This time slot is already booked');
      }
      throw err;
    }
  }

  private async assertNoConflict(
    tx: Prisma.TransactionClient,
    staffId: string,
    start: Date,
    end: Date,
    excludeBookingId?: string,
  ) {
    const conflict = await tx.booking.findFirst({
      where: {
        staffId,
        id: excludeBookingId ? { not: excludeBookingId } : undefined,
        status: { in: SLOT_BLOCKING_STATUSES },
        startDatetime: { lt: end },
        endDatetime: { gt: start },
      },
    });
    if (conflict) {
      throw new ConflictException('This time slot is already booked');
    }
    const timeOff = await tx.timeOff.findFirst({
      where: {
        staffId,
        startDatetime: { lt: end },
        endDatetime: { gt: start },
      },
    });
    if (timeOff) {
      throw new ConflictException('Staff member is on time off at this time');
    }
  }

  private async assertStaffAvailable(
    staffId: string,
    start: Date,
    end: Date,
    timeZone: string,
  ) {
    const startParts = getZonedParts(start, timeZone);
    const endParts = getZonedParts(end, timeZone);
    const availability = await this.prisma.availability.findFirst({
      where: { staffId, dayOfWeek: startParts.dayOfWeek },
    });
    if (!availability) {
      throw new BadRequestException('Staff is not available on that day');
    }
    const [availStartH, availStartM] = availability.startTime
      .split(':')
      .map(Number);
    const [availEndH, availEndM] = availability.endTime.split(':').map(Number);
    const startMinutes = startParts.hour * 60 + startParts.minute;
    const endMinutes = endParts.hour * 60 + endParts.minute;
    const availStartMinutes = availStartH * 60 + availStartM;
    const availEndMinutes = availEndH * 60 + availEndM;
    if (
      startParts.year !== endParts.year ||
      startParts.month !== endParts.month ||
      startParts.day !== endParts.day ||
      startMinutes < availStartMinutes ||
      endMinutes > availEndMinutes
    ) {
      throw new BadRequestException(
        'That time is outside the staff working hours',
      );
    }
  }

  async cancelBooking(bookingId: string, userId: string, userRole: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { business: { select: { ownerId: true } } },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const isConsumer = booking.consumerId === userId;
    const isOwner = booking.business.ownerId === userId;
    const isAdmin = userRole === UserRole.admin;

    if (!isConsumer && !isOwner && !isAdmin) {
      throw new ForbiddenException('Not authorized to cancel this booking');
    }

    if (
      booking.status === BookingStatus.cancelled ||
      booking.status === BookingStatus.completed ||
      booking.status === BookingStatus.no_show
    ) {
      throw new BadRequestException(
        `Cannot cancel a booking with status "${booking.status}"`,
      );
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.cancelled,
        reminderAt: null,
      },
      include: {
        business: { select: { name: true } },
        service: { select: { name: true } },
      },
    });

    if (booking.consumerId) {
      await this.notifications.create({
        userId: booking.consumerId,
        type: NotificationType.booking_cancelled,
        title: 'Appointment cancelled',
        body: `${updated.service.name} at ${updated.business.name} was cancelled.`,
        href: '/notifications',
        bookingId: updated.id,
      });
    }

    void this.googleCalendar.syncBookingSafe(updated.id);

    return { bookingId: updated.id, status: updated.status };
  }

  async rescheduleBooking(
    bookingId: string,
    userId: string,
    dto: { startDatetime: string; staffId?: string },
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        consumer: { select: { remindersEnabled: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.consumerId !== userId) {
      throw new ForbiddenException('Only the client can reschedule this booking');
    }
    if (
      booking.status === BookingStatus.cancelled ||
      booking.status === BookingStatus.completed ||
      booking.status === BookingStatus.no_show
    ) {
      throw new BadRequestException('This booking can no longer be rescheduled');
    }

    const start = new Date(dto.startDatetime);
    if (isNaN(start.getTime())) {
      throw new BadRequestException('Invalid startDatetime');
    }
    if (start.getTime() <= Date.now()) {
      throw new BadRequestException('Choose a future time');
    }

    const limits = bookingAbuseLimits();
    const advanceLimit = Date.now() + maxAdvanceMs(limits.maxAdvanceDays);
    if (start.getTime() > advanceLimit) {
      throw new BadRequestException(
        `You can only book up to ${limits.maxAdvanceDays} days ahead.`,
      );
    }

    const staffId = dto.staffId ?? booking.staffId;
    const end = new Date(
      start.getTime() + booking.service.durationMinutes * 60 * 1000,
    );

    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, businessId: booking.businessId },
      select: { id: true },
    });
    if (!staff) {
      throw new BadRequestException('Staff does not belong to this business');
    }

    const assignedCount = await this.prisma.staffService.count({
      where: { serviceId: booking.serviceId },
    });
    if (assignedCount > 0) {
      const assigned = await this.prisma.staffService.findFirst({
        where: { serviceId: booking.serviceId, staffId },
      });
      if (!assigned) {
        throw new BadRequestException(
          'This staff member is not assigned to that service',
        );
      }
    }

    const location = await this.prisma.location.findFirst({
      where: { id: booking.locationId, businessId: booking.businessId },
      select: { timezone: true },
    });
    const timeZone = location?.timezone || DEFAULT_VENUE_TIMEZONE;
    const startParts = getZonedParts(start, timeZone);
    const endParts = getZonedParts(end, timeZone);
    const availability = await this.prisma.availability.findFirst({
      where: { staffId, dayOfWeek: startParts.dayOfWeek },
    });
    if (!availability) {
      throw new BadRequestException('Staff is not available on that day');
    }
    const [availStartH, availStartM] = availability.startTime
      .split(':')
      .map(Number);
    const [availEndH, availEndM] = availability.endTime.split(':').map(Number);
    const startMinutes = startParts.hour * 60 + startParts.minute;
    const endMinutes = endParts.hour * 60 + endParts.minute;
    if (
      startParts.year !== endParts.year ||
      startParts.month !== endParts.month ||
      startParts.day !== endParts.day ||
      startMinutes < availStartH * 60 + availStartM ||
      endMinutes > availEndH * 60 + availEndM
    ) {
      throw new BadRequestException(
        'That time is outside the staff working hours',
      );
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const conflict = await tx.booking.findFirst({
          where: {
            staffId,
            id: { not: bookingId },
            status: { in: SLOT_BLOCKING_STATUSES },
            startDatetime: { lt: end },
            endDatetime: { gt: start },
          },
        });
        if (conflict) {
          throw new ConflictException(
            'This time slot has already been booked by another client',
          );
        }

        const timeOff = await tx.timeOff.findFirst({
          where: {
            staffId,
            startDatetime: { lt: end },
            endDatetime: { gt: start },
          },
        });
        if (timeOff) {
          throw new ConflictException('Staff member is on time off at this time');
        }

        const reminderAt =
          booking.consumer?.remindersEnabled === false
            ? null
            : new Date(start.getTime() - 24 * 60 * 60 * 1000);

        const updated = await tx.booking.update({
          where: { id: bookingId },
          data: {
            staffId,
            startDatetime: start,
            endDatetime: end,
            reminderAt:
              reminderAt && reminderAt.getTime() > Date.now() ? reminderAt : null,
            reminderSentAt: null,
            status: BookingStatus.confirmed,
          },
          include: {
            business: { select: { name: true } },
            service: { select: { name: true } },
            staff: { include: { user: { select: { name: true } } } },
          },
        });

        return {
          bookingId: updated.id,
          status: updated.status,
          startDatetime: updated.startDatetime.toISOString(),
          endDatetime: updated.endDatetime.toISOString(),
          staffId: updated.staffId,
          staffName: staffDisplayName(updated.staff),
          serviceName: updated.service.name,
          businessName: updated.business.name,
          reminderAt: updated.reminderAt?.toISOString() ?? null,
        };
      });

      await this.notifications.create({
        userId,
        type: NotificationType.booking_rescheduled,
        title: 'Appointment rescheduled',
        body: `${result.serviceName} at ${result.businessName} moved to ${formatDateTimeInZone(new Date(result.startDatetime), timeZone)} (${timeZone}) with ${result.staffName}.`,
        href: '/notifications',
        bookingId: result.bookingId,
      });

      void this.googleCalendar.syncBookingSafe(result.bookingId);

      return { ...result, timeZone };
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      if (isExclusionConflict(err)) {
        throw new ConflictException(
          'This time slot has already been booked by another client',
        );
      }
      throw err;
    }
  }

  async processDueReminders() {
    const due = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.confirmed,
        reminderAt: { lte: new Date() },
        reminderSentAt: null,
        startDatetime: { gt: new Date() },
      },
      include: {
        consumer: { select: { name: true, email: true } },
        business: { select: { name: true } },
        service: { select: { name: true } },
        staff: { include: { user: { select: { name: true } } } },
        location: { select: { timezone: true } },
      },
      take: 50,
    });

    const sent: Array<{ bookingId: string; to: string; message: string }> = [];
    for (const b of due) {
      if (!b.consumerId || !b.consumer?.email) {
        await this.prisma.booking.updateMany({
          where: { id: b.id, reminderSentAt: null },
          data: { reminderSentAt: new Date() },
        });
        continue;
      }
      const timeZone = b.location.timezone || DEFAULT_VENUE_TIMEZONE;
      const when = formatDateTimeInZone(b.startDatetime, timeZone);
      const body = `Reminder: ${b.service.name} at ${b.business.name} with ${staffDisplayName(b.staff)} on ${when} (${timeZone}).`;
      const message = body;

      // Claim first so concurrent cron workers cannot double-send.
      const claimed = await this.prisma.booking.updateMany({
        where: { id: b.id, reminderSentAt: null },
        data: { reminderSentAt: new Date() },
      });
      if (claimed.count === 0) {
        continue;
      }

      try {
        await this.mail.send({
          to: b.consumer.email,
          subject: `Reminder — ${b.service.name} tomorrow`,
          text: `Hi ${b.consumer.name},\n\n${body} Pay at the venue.\n\nSee your bookings: /home\n\n— Easement`,
        });
      } catch (err) {
        // Allow retry on the next cron tick.
        await this.prisma.booking.update({
          where: { id: b.id },
          data: { reminderSentAt: null },
        });
        // eslint-disable-next-line no-console
        console.error(`Reminder email failed for booking ${b.id}`, err);
        continue;
      }

      await this.notifications.create({
        userId: b.consumerId,
        type: NotificationType.reminder,
        title: 'Appointment tomorrow',
        body,
        href: '/notifications',
        bookingId: b.id,
      });

      sent.push({ bookingId: b.id, to: b.consumer.email, message });
    }
    return { processed: sent.length, reminders: sent };
  }

  async completeBooking(
    bookingId: string,
    userId: string,
    dto: CompleteBookingDto,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        business: { select: { ownerId: true, name: true } },
        service: { select: { name: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.business.ownerId !== userId) {
      throw new ForbiddenException('Only business owner can complete booking');
    }

    if (booking.status !== BookingStatus.confirmed && booking.status !== BookingStatus.pending) {
      throw new BadRequestException(
        `Cannot complete a booking with status "${booking.status}"`,
      );
    }

    const subtotal = booking.price;
    const taxRate = dto.taxPercentage ?? 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.completed },
      });

      const sale = await tx.sale.upsert({
        where: { bookingId },
        create: {
          bookingId,
          businessId: booking.businessId,
          locationId: booking.locationId,
          staffId: booking.staffId,
          serviceId: booking.serviceId,
          subtotal,
          taxAmount,
          total,
          paymentMethod: dto.paymentMethod ?? PaymentMethod.cash,
        },
        update: {
          subtotal,
          taxAmount,
          total,
          paymentMethod: dto.paymentMethod ?? PaymentMethod.cash,
        },
      });

      return {
        bookingId: updatedBooking.id,
        status: updatedBooking.status,
        saleId: sale.id,
        subtotal: sale.subtotal,
        taxAmount: sale.taxAmount,
        total: sale.total,
        paymentMethod: sale.paymentMethod,
        soldAt: sale.soldAt.toISOString(),
      };
    });

    if (booking.consumerId) {
      await this.notifications.create({
        userId: booking.consumerId,
        type: NotificationType.review_request,
        title: 'How was your visit?',
        body: `Leave a quick review for ${booking.service.name} at ${booking.business.name}.`,
        href: '/notifications',
        bookingId: booking.id,
      });
    }

    void this.googleCalendar.syncBookingSafe(result.bookingId);

    return result;
  }

  async markNoShow(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        business: { select: { ownerId: true, name: true } },
        service: { select: { name: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.business.ownerId !== userId) {
      throw new ForbiddenException('Only business owner can mark no-show');
    }
    if (
      booking.status !== BookingStatus.confirmed &&
      booking.status !== BookingStatus.pending
    ) {
      throw new BadRequestException(
        `Cannot mark no-show for a booking with status "${booking.status}"`,
      );
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.no_show,
        reminderAt: null,
      },
    });

    if (booking.consumerId) {
      await this.notifications.create({
        userId: booking.consumerId,
        type: NotificationType.booking_cancelled,
        title: 'Marked as no-show',
        body: `${booking.service.name} at ${booking.business.name} was marked as a missed appointment. The time slot is open again.`,
        href: '/notifications',
        bookingId: updated.id,
      });
    }

    void this.googleCalendar.syncBookingSafe(updated.id);

    return { bookingId: updated.id, status: updated.status };
  }

  async createReview(bookingId: string, consumerId: string, dto: CreateReviewDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.consumerId !== consumerId) {
      throw new ForbiddenException('Only the booking client can submit a review');
    }

    if (booking.status !== BookingStatus.completed) {
      throw new BadRequestException('Reviews can only be submitted for completed appointments');
    }

    const review = await this.prisma.review.create({
      data: {
        bookingId,
        consumerId,
        businessId: booking.businessId,
        rating: dto.rating,
        comment: dto.comment,
      },
    });

    return {
      reviewId: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
    };
  }
}
