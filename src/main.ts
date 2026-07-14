import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const origins = new Set(
    [
      'https://personal-task-assistant-ruby.vercel.app',
      ...String(process.env.FRONTEND_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ]
      .map(normalizeOrigin)
      .filter((origin): origin is string => Boolean(origin)),
  );
  app.enableCors({
    origin(
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) {
      const normalizedOrigin = normalizeOrigin(origin);
      if (!normalizedOrigin || origins.has(normalizedOrigin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin is not allowed by CORS'), false);
    },
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`HTTP API listening on port ${port}`, 'Bootstrap');
}

function normalizeOrigin(origin: string | undefined): string | null {
  if (!origin) return null;
  try {
    const parsed = new URL(origin);
    return parsed.origin;
  } catch {
    return origin.replace(/\/+$/, '');
  }
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error';
  Logger.error(message, undefined, 'Bootstrap');
  process.exitCode = 1;
});
