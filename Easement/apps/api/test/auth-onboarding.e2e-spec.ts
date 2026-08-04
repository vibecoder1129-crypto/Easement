import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth + onboarding (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.use(
      session({
        name: 'ezment.sid',
        secret: 'test-session-secret',
        resave: false,
        saveUninitialized: false,
        cookie: { httpOnly: true, sameSite: 'lax', secure: false },
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.staff.deleteMany({
      where: { user: { email: { contains: `e2e-${suffix}` } } },
    });
    await prisma.location.deleteMany({
      where: { business: { owner: { email: { contains: `e2e-${suffix}` } } } },
    });
    await prisma.business.deleteMany({
      where: { owner: { email: { contains: `e2e-${suffix}` } } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: `e2e-${suffix}` } },
    });
    await app.close();
  });

  it('signs up, onboards, and isolates businesses by owner', async () => {
    const agentA = request.agent(app.getHttpServer());
    const agentB = request.agent(app.getHttpServer());

    const signupA = await agentA.post('/auth/signup').send({
      name: 'Owner A',
      email: `owner-a-e2e-${suffix}@example.com`,
      password: 'password123',
      role: 'business_owner',
    });
    expect(signupA.status).toBe(201);
    expect(signupA.body.role).toBe('business_owner');

    const me = await agentA.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(`owner-a-e2e-${suffix}@example.com`);

    const business = await agentA.post('/businesses').send({
      name: 'Salon A',
      category: 'salon',
    });
    expect(business.status).toBe(201);
    const businessId = business.body.businessId as string;

    const location = await agentA
      .post(`/businesses/${businessId}/locations`)
      .send({
        name: 'Main',
        address: '1 Test St',
        lat: 40.7,
        lng: -74.0,
        timezone: 'America/New_York',
      });
    expect(location.status).toBe(201);

    const staff = await agentA.post(`/businesses/${businessId}/staff`).send({
      locationId: location.body.locationId,
      title: 'Owner',
    });
    expect(staff.status).toBe(201);

    const detail = await agentA.get(`/businesses/${businessId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.locations).toHaveLength(1);
    expect(detail.body.staff).toHaveLength(1);

    await agentB.post('/auth/signup').send({
      name: 'Owner B',
      email: `owner-b-e2e-${suffix}@example.com`,
      password: 'password123',
      role: 'business_owner',
    });

    const forbidden = await agentB.get(`/businesses/${businessId}`);
    expect(forbidden.status).toBe(403);
  });
});
