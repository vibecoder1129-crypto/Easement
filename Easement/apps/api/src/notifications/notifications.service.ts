import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    href?: string;
    bookingId?: string;
  }) {
    try {
      return await this.prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          href: input.href,
          bookingId: input.bookingId,
        },
      });
    } catch (err) {
      // Never fail the parent booking flow if notification persistence breaks.
      console.error('Failed to create notification', err);
      return null;
    }
  }

  async listForUser(userId: string, limit = 30) {
    const since = new Date();
    since.setDate(since.getDate() - 10);

    const items = await this.prisma.notification.findMany({
      where: {
        userId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      href: n.href,
      bookingId: n.bookingId,
      read: !!n.readAt,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  async unreadCount(userId: string) {
    const since = new Date();
    since.setDate(since.getDate() - 10);

    const count = await this.prisma.notification.count({
      where: {
        userId,
        readAt: null,
        createdAt: { gte: since },
      },
    });
    return { count };
  }

  async markRead(userId: string, notificationId: string) {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  async remove(userId: string, notificationId: string) {
    await this.prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
    return { success: true };
  }

  async clearAll(userId: string) {
    await this.prisma.notification.deleteMany({
      where: { userId },
    });
    return { success: true };
  }
}
