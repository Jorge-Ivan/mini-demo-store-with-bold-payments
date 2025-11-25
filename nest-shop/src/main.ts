import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Bootstraps the NestJS application, enables CORS, and starts the HTTP server on port 3000.
 *
 * The application is created with raw body parsing enabled (`rawBody: true`) before CORS is enabled and the server starts.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  app.enableCors();
  await app.listen(3000);
}
bootstrap();
