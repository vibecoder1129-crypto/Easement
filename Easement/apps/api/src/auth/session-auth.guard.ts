import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';

export type SessionUser = {
  userId: string;
  role: string;
  name: string;
  email: string;
};

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
  }
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    if (!req.session?.user?.userId) {
      throw new UnauthorizedException('Not authenticated');
    }
    return true;
  }
}
