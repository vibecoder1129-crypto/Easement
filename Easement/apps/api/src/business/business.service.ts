import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssignStaffToServiceDto,
  CreateAvailabilityDto,
  CreateBusinessDto,
  CreateLocationDto,
  CreateServiceDto,
  CreateStaffDto,
  CreateTimeOffDto,
} from './dto/business.dto';
import {
  staffDisplayEmail,
  staffDisplayName,
} from './staff.util';

@Injectable()
export class BusinessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertOwner(businessId: string, userId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    if (business.ownerId !== userId) {
      throw new ForbiddenException('Not allowed to access this business');
    }
    return business;
  }

  async getMyBusinesses(userId: string) {
    const businesses = await this.prisma.business.findMany({
      where: { ownerId: userId },
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
        },
        staff: {
          select: {
            id: true,
            title: true,
            locationId: true,
            userId: true,
            name: true,
            email: true,
            user: { select: { name: true, email: true } },
          },
        },
        services: {
          select: {
            id: true,
            name: true,
            durationMinutes: true,
            price: true,
            category: true,
            staff: {
              select: { staffId: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return businesses.map((b) => ({
      businessId: b.id,
      name: b.name,
      category: b.category,
      status: b.status,
      locations: b.locations.map((l) => ({
        locationId: l.id,
        name: l.name,
        address: l.address,
        timezone: l.timezone,
        lat: l.lat,
        lng: l.lng,
      })),
      staff: b.staff.map((s) => ({
        staffId: s.id,
        title: s.title,
        locationId: s.locationId,
        userId: s.userId,
        name: staffDisplayName(s),
        email: staffDisplayEmail(s),
      })),
      services: b.services.map((s) => ({
        serviceId: s.id,
        name: s.name,
        durationMinutes: s.durationMinutes,
        price: s.price,
        category: s.category,
        staffIds: s.staff.map((st) => st.staffId),
      })),
    }));
  }

  async createBusiness(ownerId: string, dto: CreateBusinessDto) {
    const business = await this.prisma.business.create({
      data: {
        ownerId,
        name: dto.name,
        category: dto.category,
      },
    });
    return {
      businessId: business.id,
      name: business.name,
      category: business.category,
      status: business.status,
    };
  }

  async getBusiness(businessId: string, userId?: string, role?: string) {
    if (role && role !== UserRole.admin && userId) {
      await this.assertOwner(businessId, userId);
    }

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
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
        },
        staff: {
          select: {
            id: true,
            title: true,
            locationId: true,
            userId: true,
            name: true,
            email: true,
            user: { select: { name: true, email: true } },
          },
        },
        services: {
          select: {
            id: true,
            name: true,
            durationMinutes: true,
            price: true,
            category: true,
            staff: {
              select: {
                staffId: true,
              },
            },
          },
        },
      },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    return {
      businessId: business.id,
      name: business.name,
      category: business.category,
      status: business.status,
      locations: business.locations.map((l) => ({
        locationId: l.id,
        name: l.name,
        address: l.address,
        timezone: l.timezone,
        lat: l.lat,
        lng: l.lng,
      })),
      staff: business.staff.map((s) => ({
        staffId: s.id,
        title: s.title,
        locationId: s.locationId,
        userId: s.userId,
        name: staffDisplayName(s),
        email: staffDisplayEmail(s),
      })),
      services: business.services.map((s) => ({
        serviceId: s.id,
        name: s.name,
        durationMinutes: s.durationMinutes,
        price: s.price,
        category: s.category,
        staffIds: s.staff.map((st) => st.staffId),
      })),
    };
  }

  async createLocation(
    businessId: string,
    userId: string,
    dto: CreateLocationDto,
  ) {
    await this.assertOwner(businessId, userId);

    const location = await this.prisma.location.create({
      data: {
        businessId,
        name: dto.name,
        address: dto.address,
        lat: dto.lat,
        lng: dto.lng,
        timezone: dto.timezone,
      },
    });

    return {
      locationId: location.id,
      name: location.name,
      address: location.address,
      timezone: location.timezone,
    };
  }

  async listLocations(businessId: string, userId: string) {
    await this.assertOwner(businessId, userId);

    const locations = await this.prisma.location.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
    });

    return locations.map((l) => ({
      locationId: l.id,
      name: l.name,
      address: l.address,
      timezone: l.timezone,
    }));
  }

  async createStaff(businessId: string, ownerId: string, dto: CreateStaffDto) {
    await this.assertOwner(businessId, ownerId);

    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, businessId },
    });
    if (!location) {
      throw new NotFoundException('Location not found for this business');
    }

    const title = dto.title?.trim() || 'Staff';
    const trimmedName = dto.name?.trim();

    // Onboarding: link the owner as staff when no employee name is provided.
    if (!trimmedName) {
      if (dto.userId && dto.userId !== ownerId) {
        throw new BadRequestException(
          'Cannot link an existing account by id. Add staff with name and contact info instead.',
        );
      }

      const user = await this.prisma.user.findUnique({
        where: { id: ownerId },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const alreadyOnTeam = await this.prisma.staff.findFirst({
        where: { businessId, userId: ownerId },
      });
      if (alreadyOnTeam) {
        throw new ConflictException('This person is already on your team');
      }

      const staff = await this.prisma.staff.create({
        data: {
          businessId,
          locationId: dto.locationId,
          userId: ownerId,
          name: user.name,
          email: user.email,
          phone: user.phone,
          title,
        },
      });

      await this.seedDefaultAvailability(staff.id);

      return {
        staffId: staff.id,
        title: staff.title,
        locationId: staff.locationId,
        userId: staff.userId,
        name: staff.name,
        email: staff.email,
        defaultHours: 'Mon-Fri 09:00-17:00',
      };
    }

    if (dto.userId) {
      throw new BadRequestException(
        'Cannot link an existing account when adding a named employee.',
      );
    }

    const email = dto.email?.trim().toLowerCase() || null;

    const staff = await this.prisma.staff.create({
      data: {
        businessId,
        locationId: dto.locationId,
        name: trimmedName,
        email,
        phone: dto.phone?.trim() || null,
        title,
      },
    });

    await this.seedDefaultAvailability(staff.id);

    return {
      staffId: staff.id,
      title: staff.title,
      locationId: staff.locationId,
      userId: staff.userId,
      name: staff.name,
      email: staff.email,
      defaultHours: 'Mon-Fri 09:00-17:00',
    };
  }

  private async seedDefaultAvailability(staffId: string) {
    const defaultHours = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
      staffId,
      dayOfWeek,
      startTime: '09:00',
      endTime: '17:00',
    }));
    await this.prisma.availability.createMany({ data: defaultHours });
  }
  async listStaff(businessId: string, userId: string) {
    await this.assertOwner(businessId, userId);

    const staff = await this.prisma.staff.findMany({
      where: { businessId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return staff.map((s) => ({
      staffId: s.id,
      title: s.title,
      locationId: s.locationId,
      userId: s.userId,
      name: staffDisplayName(s),
      email: staffDisplayEmail(s),
    }));
  }

  // SERVICES
  async createService(businessId: string, ownerId: string, dto: CreateServiceDto) {
    await this.assertOwner(businessId, ownerId);

    const service = await this.prisma.service.create({
      data: {
        businessId,
        name: dto.name,
        durationMinutes: dto.durationMinutes,
        price: dto.price,
        category: dto.category,
      },
    });

    if (dto.staffIds && dto.staffIds.length > 0) {
      const validStaff = await this.prisma.staff.findMany({
        where: { businessId, id: { in: dto.staffIds } },
        select: { id: true },
      });
      if (validStaff.length !== dto.staffIds.length) {
        throw new BadRequestException(
          'One or more staff members do not belong to this business',
        );
      }
      await this.prisma.staffService.createMany({
        data: dto.staffIds.map((staffId) => ({
          serviceId: service.id,
          staffId,
        })),
        skipDuplicates: true,
      });
    }

    return {
      serviceId: service.id,
      name: service.name,
      durationMinutes: service.durationMinutes,
      price: service.price,
      category: service.category,
      staffIds: dto.staffIds ?? [],
    };
  }

  async listServices(businessId: string) {
    const services = await this.prisma.service.findMany({
      where: { businessId },
      include: {
        staff: {
          select: { staffId: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return services.map((s) => ({
      serviceId: s.id,
      name: s.name,
      durationMinutes: s.durationMinutes,
      price: s.price,
      category: s.category,
      staffIds: s.staff.map((st) => st.staffId),
    }));
  }

  async assignStaffToService(
    businessId: string,
    serviceId: string,
    ownerId: string,
    dto: AssignStaffToServiceDto,
  ) {
    await this.assertOwner(businessId, ownerId);

    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, businessId },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    await this.prisma.staffService.deleteMany({
      where: { serviceId },
    });

    if (dto.staffIds.length > 0) {
      const validStaff = await this.prisma.staff.findMany({
        where: { businessId, id: { in: dto.staffIds } },
        select: { id: true },
      });
      if (validStaff.length !== dto.staffIds.length) {
        throw new BadRequestException(
          'One or more staff members do not belong to this business',
        );
      }
      await this.prisma.staffService.createMany({
        data: dto.staffIds.map((staffId) => ({
          serviceId,
          staffId,
        })),
        skipDuplicates: true,
      });
    }

    return { serviceId, staffIds: dto.staffIds };
  }

  // AVAILABILITY & TIME-OFF
  async setStaffAvailability(
    staffId: string,
    userId: string,
    dto: CreateAvailabilityDto,
  ) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
    });
    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    if (staff.userId !== userId) {
      await this.assertOwner(staff.businessId, userId);
    }

    const existing = await this.prisma.availability.findFirst({
      where: { staffId, dayOfWeek: dto.dayOfWeek },
    });

    let availability;
    if (existing) {
      availability = await this.prisma.availability.update({
        where: { id: existing.id },
        data: {
          startTime: dto.startTime,
          endTime: dto.endTime,
        },
      });
    } else {
      availability = await this.prisma.availability.create({
        data: {
          staffId,
          dayOfWeek: dto.dayOfWeek,
          startTime: dto.startTime,
          endTime: dto.endTime,
        },
      });
    }

    return {
      availabilityId: availability.id,
      staffId: availability.staffId,
      dayOfWeek: availability.dayOfWeek,
      startTime: availability.startTime,
      endTime: availability.endTime,
    };
  }

  async listStaffAvailability(
    staffId: string,
    userId: string,
    role?: string,
  ) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
    });
    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }
    if (role !== UserRole.admin && staff.userId !== userId) {
      await this.assertOwner(staff.businessId, userId);
    }

    const availabilities = await this.prisma.availability.findMany({
      where: { staffId },
      orderBy: { dayOfWeek: 'asc' },
    });

    return availabilities.map((a) => ({
      availabilityId: a.id,
      staffId: a.staffId,
      dayOfWeek: a.dayOfWeek,
      startTime: a.startTime,
      endTime: a.endTime,
    }));
  }

  async clearStaffDay(
    staffId: string,
    userId: string,
    dayOfWeek: number,
  ) {
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      throw new BadRequestException('dayOfWeek must be between 0 and 6');
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
    });
    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    if (staff.userId !== userId) {
      await this.assertOwner(staff.businessId, userId);
    }

    await this.prisma.availability.deleteMany({
      where: { staffId, dayOfWeek },
    });

    return {
      staffId,
      dayOfWeek,
      dayOff: true,
    };
  }

  async addStaffTimeOff(
    staffId: string,
    userId: string,
    dto: CreateTimeOffDto,
  ) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
    });
    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    if (staff.userId !== userId) {
      await this.assertOwner(staff.businessId, userId);
    }

    const timeOff = await this.prisma.timeOff.create({
      data: {
        staffId,
        startDatetime: new Date(dto.startDatetime),
        endDatetime: new Date(dto.endDatetime),
        reason: dto.reason,
      },
    });

    return {
      timeOffId: timeOff.id,
      staffId: timeOff.staffId,
      startDatetime: timeOff.startDatetime.toISOString(),
      endDatetime: timeOff.endDatetime.toISOString(),
      reason: timeOff.reason,
    };
  }

  async listStaffTimeOff(staffId: string, userId: string, role?: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
    });
    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }
    if (role !== UserRole.admin && staff.userId !== userId) {
      await this.assertOwner(staff.businessId, userId);
    }

    const entries = await this.prisma.timeOff.findMany({
      where: { staffId },
      orderBy: { startDatetime: 'asc' },
    });

    return entries.map((e) => ({
      timeOffId: e.id,
      staffId: e.staffId,
      startDatetime: e.startDatetime.toISOString(),
      endDatetime: e.endDatetime.toISOString(),
      reason: e.reason,
    }));
  }
}
