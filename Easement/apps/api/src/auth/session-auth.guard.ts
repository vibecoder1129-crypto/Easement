import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { IS_PUBLIC_KEY } from './public.decorator';

export type SessionUser = {
  userId: string;
  role: string;
  name: string;
  email: string;
  sessionVersion: number;
};

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
  }
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const sessionUser = req.session?.user;
    if (!sessionUser?.userId) {
      throw new UnauthorizedException('Not authenticated');
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        sessionVersion: number;
        role: string;
        name: string;
        email: string;
      }>
    >`SELECT "sessionVersion", role, name, email FROM "User" WHERE id = ${sessionUser.userId}`;

    const dbUser = rows[0];
    if (!dbUser) {
      await new Promise<void>((resolve) => {
        req.session.destroy(() => resolve());
      });
      throw new UnauthorizedException('Not authenticated');
    }

    const dbVersion = Number(dbUser.sessionVersion ?? 0);
    const sessionVersion = Number(sessionUser.sessionVersion ?? -1);
    if (sessionVersion !== dbVersion) {
      await new Promise<void>((resolve) => {
        req.session.destroy(() => resolve());
      });
      throw new UnauthorizedException(
        'Session expired. Please sign in again.',
      );
    }

    req.session.user = {
      userId: sessionUser.userId,
      role: dbUser.role,
      name: dbUser.name,
      email: dbUser.email,
      sessionVersion: dbVersion,
    };

    return true;
  }
}
