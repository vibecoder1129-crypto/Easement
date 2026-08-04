import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const service = new AuthService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a business_owner on signup', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'u1',
      role: UserRole.business_owner,
    });

    const result = await service.signup({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'password123',
      role: UserRole.business_owner,
    });

    expect(result).toEqual({ userId: 'u1', role: UserRole.business_owner });
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it('rejects duplicate email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(
      service.signup({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'password123',
        role: UserRole.consumer,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid login', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.validateLogin({
        email: 'missing@example.com',
        password: 'nope',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
