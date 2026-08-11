import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CronOrAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const cronSecret = process.env.CRON_SECRET?.trim();
    const header = req.headers['x-cron-secret'];
    const headerValue = Array.isArray(header) ? header[0] : header;

    if (cronSecret && headerValue && headerValue === cronSecret) {
      return true;
    }

    const userId = req.session?.user?.userId;
    if (userId) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (dbUser?.role === UserRole.admin) {
        if (req.session.user && req.session.user.role !== dbUser.role) {
          req.session.user = { ...req.session.user, role: dbUser.role };
        }
        return true;
      }
    }

    throw new ForbiddenException(
      'Requires admin session or valid x-cron-secret header',
    );
  }
}
