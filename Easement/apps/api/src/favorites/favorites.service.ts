import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      include: {
        business: {
          include: {
            locations: {
              select: { name: true, address: true },
              take: 1,
              orderBy: { createdAt: 'asc' },
            },
            services: {
              select: { price: true },
              orderBy: { price: 'asc' },
              take: 1,
            },
            reviews: { select: { rating: true } },
            _count: { select: { reviews: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return favorites.map((f) => {
      const b = f.business;
      const ratingAvg =
        b.reviews.length === 0
          ? null
          : Math.round(
              (b.reviews.reduce((sum, r) => sum + r.rating, 0) /
                b.reviews.length) *
                10,
            ) / 10;
      return {
        favoriteId: f.id,
        businessId: b.id,
        name: b.name,
        category: b.category,
        coverImage: b.portfolio[0] ?? null,
        address: b.locations[0]?.address ?? null,
        fromPrice: b.services[0]?.price ?? null,
        ratingAvg,
        reviewCount: b._count.reviews,
        createdAt: f.createdAt.toISOString(),
      };
    });
  }

  async ids(userId: string) {
    const rows = await this.prisma.favorite.findMany({
      where: { userId },
      select: { businessId: true },
    });
    return { businessIds: rows.map((r) => r.businessId) };
  }

  async add(userId: string, businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!business) throw new NotFoundException('Business not found');

    const favorite = await this.prisma.favorite.upsert({
      where: { userId_businessId: { userId, businessId } },
      create: { userId, businessId },
      update: {},
    });
    return { businessId: favorite.businessId, favorited: true };
  }

  async remove(userId: string, businessId: string) {
    await this.prisma.favorite.deleteMany({
      where: { userId, businessId },
    });
    return { businessId, favorited: false };
  }
}
