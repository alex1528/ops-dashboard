import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useWebSocketAdapter(new IoAdapter(app));
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // In production set CORS_ORIGIN to the exact dashboard origin (e.g. https://ops.example.com).
  // Defaults to reflecting the request origin, which is safe for a private network deployment.
  const corsOrigin = process.env.CORS_ORIGIN || true;
  app.enableCors({ credentials: true, origin: corsOrigin });
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Ops Dashboard API running on port ${port}`);
}
bootstrap();
