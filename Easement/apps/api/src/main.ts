import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const isProd = process.env.NODE_ENV === 'production';

  const corsOrigin = (
    process.env.CORS_ORIGIN ??
    'http://localhost:3000,http://localhost:3002'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow same-origin / non-browser tools (no Origin header)
      if (!origin || corsOrigin.includes(origin)) {
        callback(null, true);
        return;
      }
      // Dev-only convenience: any localhost port or private LAN host
      if (!isProd) {
        if (/^http:\/\/localhost:\d+$/.test(origin)) {
          callback(null, true);
          return;
        }
        if (
          /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}):\d+$/.test(
            origin,
          )
        ) {
          callback(null, true);
          return;
        }
      }
      callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
  });

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET environment variable is required');
  }

  const cookieSecure =
    process.env.COOKIE_SECURE === 'true' ||
    (isProd && process.env.COOKIE_SECURE !== 'false');

  app.use(
    session({
      name: 'ezment.sid',
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: cookieSecure,
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    }),
  );

  const port = Number(process.env.PORT ?? 3003);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
}

bootstrap();
