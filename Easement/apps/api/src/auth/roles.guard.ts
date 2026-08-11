import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const sessionUser = req.session?.user;
    if (!sessionUser?.userId) {
      throw new ForbiddenException('Insufficient role');
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: sessionUser.userId },
      select: { role: true },
    });
    if (!dbUser) {
      throw new ForbiddenException('Insufficient role');
    }

    // Keep session role in sync when DB role changed (e.g. admin demotion).
    if (sessionUser.role !== dbUser.role) {
      req.session.user = { ...sessionUser, role: dbUser.role };
    }

    if (!roles.includes(dbUser.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
