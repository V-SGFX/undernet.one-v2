import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';

/**
 * UNDERNET.ONE — rozruch API.
 *
 * Prostsze niż w xdtv o dwie rzeczy, bo obu tu nie ma:
 *  - obchodzenie parsera ciała dla ścieżek /admin (panel jest wspólny
 *    i mieszka w backendzie xdtv, ten proces go nie montuje),
 *  - Bull Board pod /admin/queues (jw.).
 *
 * Kolejki działają dalej — brakuje tylko ich podglądu, który i tak jest
 * jeden dla obu serwisów.
 */
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  app.useStaticAssets(path.join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.enableCors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3005').split(','),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.setGlobalPrefix('api', { exclude: ['/'] });

  const port = parseInt(process.env.PORT || '4100', 10);
  app.enableShutdownHooks();
  await app.listen(port);
  console.log(`[UNDERNET API] port ${port} (${process.env.NODE_ENV})`);
}

/*
 * Błąd rozruchu musi być głośny i kończyć proces kodem niezerowym.
 * Ciche `void bootstrap()` sprawia, że przy zajętym porcie stary proces
 * dalej obsługuje ruch, a wdrożony kod nigdy nie wchodzi do użycia —
 * objawia się to jako „działa w testach, nie działa na serwerze".
 */
bootstrap().catch((error) => {
  console.error('[UNDERNET API] rozruch nie powiódł się:', error);
  process.exit(1);
});
