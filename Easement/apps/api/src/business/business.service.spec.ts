import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BusinessService } from './business.service';

describe('BusinessService', () => {
  const prisma = {
    business: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    location: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    staff: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  const service = new BusinessService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks access to another owner business', async () => {
    prisma.business.findUnique.mockResolvedValue({
      id: 'b1',
      ownerId: 'owner-a',
    });

    await expect(service.assertOwner('b1', 'owner-b')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('creates a business for the owner', async () => {
    prisma.business.create.mockResolvedValue({
      id: 'b1',
      name: 'Glow Salon',
      category: 'salon',
      status: 'pending',
    });

    const result = await service.createBusiness('owner-a', {
      name: 'Glow Salon',
      category: 'salon',
    });

    expect(result.businessId).toBe('b1');
    expect(result.status).toBe('pending');
  });

  it('rejects staff create when location missing', async () => {
    prisma.business.findUnique.mockResolvedValue({
      id: 'b1',
      ownerId: 'owner-a',
    });
    prisma.location.findFirst.mockResolvedValue(null);

    await expect(
      service.createStaff('b1', 'owner-a', {
        locationId: 'missing',
        title: 'Stylist',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
