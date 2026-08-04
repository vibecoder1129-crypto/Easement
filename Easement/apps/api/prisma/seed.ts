import { PrismaClient, BookingStatus, BusinessStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_OWNER_EMAIL = 'demo.salon@easement.local';
const DEMO_PASSWORD = 'DemoSalon123!';

/** Stable Unsplash salon/spa imagery for demo portfolio */
const PORTFOLIO = [
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=80',
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80',
  'https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=800&q=80',
  'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800&q=80',
  'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=800&q=80',
  'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=800&q=80',
];

async function wipeMarketplaceData() {
  await prisma.sale.deleteMany();
  await prisma.review.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.timeOff.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.staffService.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.service.deleteMany();
  await prisma.taxRate.deleteMany();
  await prisma.location.deleteMany();
  await prisma.business.deleteMany();
}

async function upsertUser(input: {
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  password: string;
}) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      phone: input.phone,
      role: input.role,
      passwordHash,
    },
    create: {
      email: input.email,
      name: input.name,
      phone: input.phone,
      role: input.role,
      passwordHash,
    },
  });
}

function daysAgo(days: number, hour = 11) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function main() {
  console.log('Wiping existing businesses and related data…');
  await wipeMarketplaceData();

  const owner = await upsertUser({
    email: DEMO_OWNER_EMAIL,
    name: 'Elena Vasar',
    phone: '+371 20 000 001',
    role: UserRole.business_owner,
    password: DEMO_PASSWORD,
  });

  await upsertUser({
    email: 'admin@easement.local',
    name: 'Easement Admin',
    phone: '+371 20 000 000',
    role: UserRole.admin,
    password: DEMO_PASSWORD,
  });

  const mila = await upsertUser({
    email: 'mila.stylist@easement.local',
    name: 'Mila Berzina',
    phone: '+371 20 000 002',
    role: UserRole.staff,
    password: DEMO_PASSWORD,
  });

  const jonas = await upsertUser({
    email: 'jonas.barber@easement.local',
    name: 'Jonas Kalnins',
    phone: '+371 20 000 003',
    role: UserRole.staff,
    password: DEMO_PASSWORD,
  });

  const reviewers = await Promise.all([
    upsertUser({
      email: 'anna.client@easement.local',
      name: 'Anna K.',
      role: UserRole.consumer,
      password: DEMO_PASSWORD,
    }),
    upsertUser({
      email: 'tom.client@easement.local',
      name: 'Tom R.',
      role: UserRole.consumer,
      password: DEMO_PASSWORD,
    }),
    upsertUser({
      email: 'sofia.client@easement.local',
      name: 'Sofia M.',
      role: UserRole.consumer,
      password: DEMO_PASSWORD,
    }),
    upsertUser({
      email: 'lukas.client@easement.local',
      name: 'Lukas P.',
      role: UserRole.consumer,
      password: DEMO_PASSWORD,
    }),
  ]);

  const business = await prisma.business.create({
    data: {
      ownerId: owner.id,
      name: 'Atelier Nord Salon',
      category: 'salon',
      status: BusinessStatus.approved,
      description:
        'A calm Riga hair studio for cuts, colour, and grooming. Soft lighting, quiet chairs, and stylists who listen first. Book online, pay at the venue when you visit.',
      portfolio: PORTFOLIO,
    },
  });

  const location = await prisma.location.create({
    data: {
      businessId: business.id,
      name: 'Centrs studio',
      address: 'Elizabetes iela 21, Centrs, Rīga, LV-1010',
      lat: 56.9532,
      lng: 24.1165,
      timezone: 'Europe/Riga',
    },
  });

  await prisma.taxRate.create({
    data: {
      businessId: business.id,
      name: 'EU (demo)',
      percentage: 0,
      isDefault: true,
    },
  });

  const services = await Promise.all([
    prisma.service.create({
      data: {
        businessId: business.id,
        name: 'Signature cut & finish',
        durationMinutes: 45,
        price: 42,
        category: 'Hair',
      },
    }),
    prisma.service.create({
      data: {
        businessId: business.id,
        name: 'Colour refresh',
        durationMinutes: 90,
        price: 85,
        category: 'Colour',
      },
    }),
    prisma.service.create({
      data: {
        businessId: business.id,
        name: 'Blow dry',
        durationMinutes: 30,
        price: 28,
        category: 'Hair',
      },
    }),
    prisma.service.create({
      data: {
        businessId: business.id,
        name: 'Classic beard trim',
        durationMinutes: 30,
        price: 25,
        category: 'Grooming',
      },
    }),
  ]);

  const [cut, colour, blowdry, beard] = services;

  const milaStaff = await prisma.staff.create({
    data: {
      businessId: business.id,
      locationId: location.id,
      userId: mila.id,
      title: 'Senior stylist',
      photoUrl:
        'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=400&q=80',
    },
  });

  const jonasStaff = await prisma.staff.create({
    data: {
      businessId: business.id,
      locationId: location.id,
      userId: jonas.id,
      title: 'Barber & stylist',
      photoUrl:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
    },
  });

  // Mon–Sat 09:00–19:00
  for (const staffId of [milaStaff.id, jonasStaff.id]) {
    for (const dayOfWeek of [1, 2, 3, 4, 5, 6]) {
      await prisma.availability.create({
        data: { staffId, dayOfWeek, startTime: '09:00', endTime: '19:00' },
      });
    }
  }

  await prisma.staffService.createMany({
    data: [
      { staffId: milaStaff.id, serviceId: cut.id },
      { staffId: milaStaff.id, serviceId: colour.id },
      { staffId: milaStaff.id, serviceId: blowdry.id },
      { staffId: jonasStaff.id, serviceId: cut.id },
      { staffId: jonasStaff.id, serviceId: beard.id },
      { staffId: jonasStaff.id, serviceId: blowdry.id },
    ],
  });

  const reviewSpecs: Array<{
    consumer: (typeof reviewers)[number];
    serviceId: string;
    staffId: string;
    daysAgo: number;
    rating: number;
    comment: string;
    price: number;
    durationMinutes: number;
  }> = [
    {
      consumer: reviewers[0],
      serviceId: cut.id,
      staffId: milaStaff.id,
      daysAgo: 18,
      rating: 5,
      comment: 'Mila took her time and the cut still looks great two weeks later.',
      price: 42,
      durationMinutes: 45,
    },
    {
      consumer: reviewers[1],
      serviceId: beard.id,
      staffId: jonasStaff.id,
      daysAgo: 12,
      rating: 5,
      comment: 'Clean trim, easy booking, paid at the chair. Will come back.',
      price: 25,
      durationMinutes: 30,
    },
    {
      consumer: reviewers[2],
      serviceId: colour.id,
      staffId: milaStaff.id,
      daysAgo: 9,
      rating: 4,
      comment: 'Beautiful colour. Studio is quiet and well kept.',
      price: 85,
      durationMinutes: 90,
    },
    {
      consumer: reviewers[3],
      serviceId: blowdry.id,
      staffId: milaStaff.id,
      daysAgo: 4,
      rating: 5,
      comment: 'Quick blow dry before an event. Exactly what I needed.',
      price: 28,
      durationMinutes: 30,
    },
  ];

  for (const spec of reviewSpecs) {
    const start = daysAgo(spec.daysAgo, 11);
    const end = new Date(start.getTime() + spec.durationMinutes * 60_000);
    const booking = await prisma.booking.create({
      data: {
        consumerId: spec.consumer.id,
        businessId: business.id,
        locationId: location.id,
        staffId: spec.staffId,
        serviceId: spec.serviceId,
        startDatetime: start,
        endDatetime: end,
        status: BookingStatus.completed,
        price: spec.price,
      },
    });
    await prisma.review.create({
      data: {
        bookingId: booking.id,
        consumerId: spec.consumer.id,
        businessId: business.id,
        rating: spec.rating,
        comment: spec.comment,
      },
    });
    await prisma.sale.create({
      data: {
        bookingId: booking.id,
        businessId: business.id,
        locationId: location.id,
        staffId: spec.staffId,
        serviceId: spec.serviceId,
        subtotal: spec.price,
        taxAmount: 0,
        total: spec.price,
      },
    });
  }

  console.log('\nDemo salon ready.');
  console.log(`  Business: ${business.name} (${business.id})`);
  console.log(`  Location: ${location.address}`);
  console.log(`  Owner login: ${DEMO_OWNER_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  Client logins (reviews): anna.client@easement.local / ${DEMO_PASSWORD}`);
  console.log('  Portfolio images: 6');
  console.log(`  Reviews: ${reviewSpecs.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
