import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { staffDisplayName } from '../business/staff.util';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getBusinessAnalytics(
    businessId: string,
    userId: string,
    userRole: string,
    startDate?: string,
    endDate?: string,
  ) {
    if (userRole !== UserRole.admin) {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
      });
      if (!business) throw new NotFoundException('Business not found');
      if (business.ownerId !== userId) {
        throw new ForbiddenException('Not authorized to access analytics for this business');
      }
    }

    const bookingWhere: any = { businessId };
    const saleWhere: any = { businessId };

    if (startDate || endDate) {
      bookingWhere.startDatetime = {};
      saleWhere.soldAt = {};
      if (startDate) {
        bookingWhere.startDatetime.gte = new Date(startDate);
        saleWhere.soldAt.gte = new Date(startDate);
      }
      if (endDate) {
        bookingWhere.startDatetime.lte = new Date(endDate);
        saleWhere.soldAt.lte = new Date(endDate);
      }
    }

    // Aggregate Sales
    const sales = await this.prisma.sale.findMany({
      where: saleWhere,
      include: {
        staff: { include: { user: { select: { name: true } } } },
        service: { select: { name: true, category: true } },
      },
    });

    const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0);

    // Aggregate Bookings
    const bookings = await this.prisma.booking.findMany({
      where: bookingWhere,
      include: {
        staff: { include: { user: { select: { name: true } } } },
        service: { select: { name: true } },
      },
    });

    const totalAppointments = bookings.length;
    const completedAppointments = bookings.filter(
      (b) => b.status === BookingStatus.completed,
    ).length;
    const cancelledAppointments = bookings.filter(
      (b) => b.status === BookingStatus.cancelled,
    ).length;
    const noShowAppointments = bookings.filter(
      (b) => b.status === BookingStatus.no_show,
    ).length;

    const averageTicketSize =
      completedAppointments > 0 ? totalRevenue / completedAppointments : 0;

    // Staff Performance Breakdown
    const staffMembers = await this.prisma.staff.findMany({
      where: { businessId },
      include: { user: { select: { name: true } } },
    });

    const performanceByEmployee = staffMembers.map((staff) => {
      const staffBookings = bookings.filter((b) => b.staffId === staff.id);
      const staffSales = sales.filter((s) => s.staffId === staff.id);

      const staffTotalAppts = staffBookings.length;
      const staffCompletedAppts = staffBookings.filter(
        (b) => b.status === BookingStatus.completed,
      ).length;
      const staffRevenue = staffSales.reduce((acc, s) => acc + s.total, 0);

      return {
        staffId: staff.id,
        staffName: staffDisplayName(staff),
        title: staff.title,
        totalAppointments: staffTotalAppts,
        completedAppointments: staffCompletedAppts,
        totalRevenueGenerated: Number(staffRevenue.toFixed(2)),
        averageRevenuePerAppointment:
          staffCompletedAppts > 0
            ? Number((staffRevenue / staffCompletedAppts).toFixed(2))
            : 0,
      };
    });

    // Revenue by Service Breakdown
    const services = await this.prisma.service.findMany({
      where: { businessId },
    });

    const revenueByService = services.map((service) => {
      const serviceSales = sales.filter((s) => s.serviceId === service.id);
      const serviceBookings = bookings.filter((b) => b.serviceId === service.id);

      const totalServiceRevenue = serviceSales.reduce((acc, s) => acc + s.total, 0);

      return {
        serviceId: service.id,
        serviceName: service.name,
        category: service.category,
        totalAppointments: serviceBookings.length,
        totalRevenue: Number(totalServiceRevenue.toFixed(2)),
      };
    });

    return {
      summary: {
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        noShowAppointments,
        averageTicketSize: Number(averageTicketSize.toFixed(2)),
      },
      performanceByEmployee,
      revenueByService,
    };
  }
}
