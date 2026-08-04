import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChangePasswordDto,
  LoginDto,
  SignupDto,
  UpdateProfileDto,
} from './dto/auth.dto';

const ALLOWED_SIGNUP_ROLES: UserRole[] = [
  UserRole.consumer,
  UserRole.business_owner,
];

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async signup(dto: SignupDto) {
    if (!ALLOWED_SIGNUP_ROLES.includes(dto.role)) {
      throw new BadRequestException('Invalid signup role');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        passwordHash,
        role: dto.role,
      },
    });

    return { userId: user.id, role: user.role };
  }

  async validateLogin(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('Not authenticated');
    }
    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      remindersEnabled: user.remindersEnabled,
    };
  }

  async updatePreferences(
    userId: string,
    dto: { remindersEnabled?: boolean },
  ) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.remindersEnabled !== undefined
          ? { remindersEnabled: dto.remindersEnabled }
          : {}),
      },
    });
    return this.getMe(user.id);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (
      dto.name === undefined &&
      dto.email === undefined &&
      dto.phone === undefined
    ) {
      throw new BadRequestException('No profile fields to update');
    }

    if (dto.email) {
      const email = dto.email.toLowerCase().trim();
      const taken = await this.prisma.user.findFirst({
        where: { email, NOT: { id: userId } },
      });
      if (taken) {
        throw new ConflictException('Email already in use');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.email !== undefined
          ? { email: dto.email.toLowerCase().trim() }
          : {}),
        ...(dto.phone !== undefined
          ? { phone: dto.phone.trim() ? dto.phone.trim() : null }
          : {}),
      },
    });

    return this.getMe(user.id);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Not authenticated');
    }

    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { success: true };
  }

  async deleteAccount(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        ownedBusinesses: { select: { id: true } },
        staffProfiles: { select: { id: true } },
      },
    });
    if (!user) {
      throw new UnauthorizedException('Not authenticated');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Password is incorrect');
    }

    if (user.ownedBusinesses.length > 0) {
      throw new BadRequestException(
        'You still own a business. Remove or transfer it before deleting your account.',
      );
    }
    if (user.staffProfiles.length > 0) {
      throw new BadRequestException(
        'You are still linked as staff at a venue. Ask the owner to remove you first.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.notification.deleteMany({ where: { userId } });
      await tx.favorite.deleteMany({ where: { userId } });

      const bookings = await tx.booking.findMany({
        where: { consumerId: userId },
        select: { id: true },
      });
      const bookingIds = bookings.map((b) => b.id);

      if (bookingIds.length > 0) {
        await tx.sale.deleteMany({ where: { bookingId: { in: bookingIds } } });
        await tx.review.deleteMany({
          where: { bookingId: { in: bookingIds } },
        });
        await tx.booking.deleteMany({ where: { id: { in: bookingIds } } });
      }

      await tx.review.deleteMany({ where: { consumerId: userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    return { success: true };
  }
}
