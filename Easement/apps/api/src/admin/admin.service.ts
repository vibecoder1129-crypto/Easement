import { Injectable, NotFoundException } from '@nestjs/common';
import { BusinessStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listBusinesses(status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending') {
    const where =
      status === 'all' ? {} : { status: status as BusinessStatus };

    const businesses = await this.prisma.business.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { locations: true, staff: true, services: true } },
      },
    });

    return businesses.map((b) => ({
      businessId: b.id,
      name: b.name,
      category: b.category,
      status: b.status,
      createdAt: b.createdAt.toISOString(),
      owner: {
        userId: b.owner.id,
        name: b.owner.name,
        email: b.owner.email,
      },
      locationCount: b._count.locations,
      staffCount: b._count.staff,
      serviceCount: b._count.services,
    }));
  }

  async updateStatus(businessId: string, status: 'approved' | 'rejected') {
    const existing = await this.prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!existing) {
      throw new NotFoundException('Business not found');
    }

    const updated = await this.prisma.business.update({
      where: { id: businessId },
      data: { status: status as BusinessStatus },
    });

    return {
      businessId: updated.id,
      name: updated.name,
      status: updated.status,
    };
  }
}
