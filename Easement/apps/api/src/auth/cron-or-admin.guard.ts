import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';

@Injectable()
export class CronOrAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const cronSecret = process.env.CRON_SECRET?.trim();
    const header = req.headers['x-cron-secret'];
    const headerValue = Array.isArray(header) ? header[0] : header;

    if (cronSecret && headerValue && headerValue === cronSecret) {
      return true;
    }

    if (req.session?.user?.role === UserRole.admin) {
      return true;
    }

    throw new ForbiddenException(
      'Requires admin session or valid x-cron-secret header',
    );
  }
}
