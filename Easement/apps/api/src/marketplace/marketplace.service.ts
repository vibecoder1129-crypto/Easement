import { Injectable, NotFoundException } from '@nestjs/common';
import { BusinessStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatClock(t: string) {
  const [hStr, mStr] = t.split(':');
  const h = Number(hStr);
  const m = Number(mStr || 0);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}:00 ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  async listBusinesses(category?: string, q?: string, area?: string) {
    const businesses = await this.prisma.business.findMany({
      where: {
        status: BusinessStatus.approved,
        ...(category ? { category } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { category: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                {
                  locations: {
                    some: {
                      OR: [
                        { address: { contains: q, mode: 'insensitive' } },
                        { name: { contains: q, mode: 'insensitive' } },
                      ],
                    },
                  },
                },
              ],
            }
          : {}),
        ...(area
          ? {
              locations: {
                some: {
                  OR: [
                    { address: { contains: area, mode: 'insensitive' } },
                    { name: { contains: area, mode: 'insensitive' } },
                  ],
                },
              },
            }
          : {}),
      },
      include: {
        locations: {
          select: {
            id: true,
            name: true,
            address: true,
            timezone: true,
          },
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
        services: {
          select: { id: true, price: true },
          orderBy: { price: 'asc' },
          take: 1,
        },
        reviews: {
          select: { rating: true },
        },
        _count: {
          select: { services: true, staff: true, reviews: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return businesses.map((b) => {
      const ratingAvg =
        b.reviews.length === 0
          ? null
          : Math.round(
              (b.reviews.reduce((sum, r) => sum + r.rating, 0) /
                b.reviews.length) *
                10,
            ) / 10;

      return {
        businessId: b.id,
        name: b.name,
        category: b.category,
        description: b.description,
        coverImage: b.portfolio[0] ?? null,
        portfolio: b.portfolio,
        locationName: b.locations[0]?.name ?? null,
        address: b.locations[0]?.address ?? null,
        timezone: b.locations[0]?.timezone ?? null,
        fromPrice: b.services[0]?.price ?? null,
        serviceCount: b._count.services,
        staffCount: b._count.staff,
        ratingAvg,
        reviewCount: b._count.reviews,
      };
    });
  }

  async getPublicBusiness(businessId: string) {
    const business = await this.prisma.business.findFirst({
      where: {
        id: businessId,
        status: BusinessStatus.approved,
      },
      include: {
        locations: {
          select: {
            id: true,
            name: true,
            address: true,
            timezone: true,
            lat: true,
            lng: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        services: {
          select: {
            id: true,
            name: true,
            durationMinutes: true,
            price: true,
            category: true,
            staff: { select: { staffId: true } },
          },
          orderBy: { name: 'asc' },
        },
        staff: {
          select: {
            id: true,
            title: true,
            photoUrl: true,
            locationId: true,
            user: { select: { name: true } },
            availability: {
              select: { dayOfWeek: true, startTime: true, endTime: true },
              orderBy: { dayOfWeek: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        reviews: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            consumer: { select: { name: true } },
            booking: { select: { staffId: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        _count: { select: { reviews: true } },
      },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const ratingAvg =
      business.reviews.length === 0
        ? null
        : Math.round(
            (business.reviews.reduce((sum, r) => sum + r.rating, 0) /
              business.reviews.length) *
              10,
          ) / 10;

    const staffRatingMap = new Map<string, { sum: number; count: number }>();
    for (const r of business.reviews) {
      const sid = r.booking.staffId;
      const cur = staffRatingMap.get(sid) ?? { sum: 0, count: 0 };
      cur.sum += r.rating;
      cur.count += 1;
      staffRatingMap.set(sid, cur);
    }

    const dayMap = new Map<number, { start: number; end: number }>();
    for (const s of business.staff) {
      for (const a of s.availability) {
        const start = timeToMinutes(a.startTime);
        const end = timeToMinutes(a.endTime);
        const cur = dayMap.get(a.dayOfWeek);
        if (!cur) {
          dayMap.set(a.dayOfWeek, { start, end });
        } else {
          dayMap.set(a.dayOfWeek, {
            start: Math.min(cur.start, start),
            end: Math.max(cur.end, end),
          });
        }
      }
    }

    // Mon→Sun display order
    const hours = [1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => {
      const span = dayMap.get(dayOfWeek);
      return {
        dayOfWeek,
        label: DAY_LABELS[dayOfWeek],
        closed: !span,
        openTime: span ? minutesToTime(span.start) : null,
        closeTime: span ? minutesToTime(span.end) : null,
        display: span
          ? `${formatClock(minutesToTime(span.start))} – ${formatClock(minutesToTime(span.end))}`
          : 'Closed',
      };
    });

    const timezone = business.locations[0]?.timezone ?? 'Europe/Riga';
    const openStatus = this.computeOpenStatus(dayMap, timezone);

    return {
      businessId: business.id,
      name: business.name,
      category: business.category,
      description: business.description,
      portfolio: business.portfolio,
      ratingAvg,
      reviewCount: business._count.reviews,
      hours,
      openNow: openStatus.openNow,
      openLabel: openStatus.openLabel,
      locations: business.locations.map((l) => ({
        locationId: l.id,
        name: l.name,
        address: l.address,
        timezone: l.timezone,
        lat: l.lat,
        lng: l.lng,
      })),
      services: business.services.map((s) => ({
        serviceId: s.id,
        name: s.name,
        durationMinutes: s.durationMinutes,
        price: s.price,
        category: s.category,
        staffIds: s.staff.map((st) => st.staffId),
      })),
      staff: business.staff.map((s) => {
        const stats = staffRatingMap.get(s.id);
        return {
          staffId: s.id,
          name: s.user.name,
          title: s.title,
          photoUrl: s.photoUrl,
          locationId: s.locationId,
          ratingAvg: stats
            ? Math.round((stats.sum / stats.count) * 10) / 10
            : null,
          reviewCount: stats?.count ?? 0,
        };
      }),
      reviews: business.reviews.map((r) => ({
        reviewId: r.id,
        rating: r.rating,
        comment: r.comment,
        consumerName: r.consumer.name,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  private computeOpenStatus(
    dayMap: Map<number, { start: number; end: number }>,
    timezone: string,
  ) {
    let openNow = false;
    let openLabel = 'Closed';
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(new Date());
      const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
      const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
      const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
      const dayMapShort: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
      };
      const dayOfWeek = dayMapShort[weekday] ?? new Date().getDay();
      const mins = hour * 60 + minute;
      const today = dayMap.get(dayOfWeek);

      if (today && mins >= today.start && mins < today.end) {
        return {
          openNow: true,
          openLabel: `Open · closes at ${formatClock(minutesToTime(today.end))}`,
        };
      }

      for (let i = 0; i < 7; i++) {
        const d = (dayOfWeek + i) % 7;
        const span = dayMap.get(d);
        if (!span) continue;
        if (i === 0 && mins < span.start) {
          return {
            openNow: false,
            openLabel: `Closed · opens today at ${formatClock(minutesToTime(span.start))}`,
          };
        }
        if (i > 0) {
          return {
            openNow: false,
            openLabel: `Closed · opens ${DAY_LABELS[d]} at ${formatClock(minutesToTime(span.start))}`,
          };
        }
      }

      return { openNow, openLabel };
    } catch {
      return { openNow: false, openLabel: 'Hours unavailable' };
    }
  }
}
