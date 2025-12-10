import { ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exception.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api', {
    exclude: ['docs', 'admin/queues'],
  });

  app.enableCors({
    origin: [
      'http://localhost:4000',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  setupSwagger(app);

  setupGlobalRegistrations(app);

  const logger = app.get<Logger>(WINSTON_MODULE_PROVIDER);
  const port = process.env.PORT ?? 4000;
  await app.listen(port);

  logger.info(`Server running at http://localhost:${port}/api`);
  logger.info(`Swagger docs available at http://localhost:${port}/docs`);
}

function setupSwagger(app: any) {
  const config = new DocumentBuilder()
    .setTitle('GFI Backend APIs')
    .setDescription('API documentation for GFI Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
}

function setupGlobalRegistrations(app: any) {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const logger = app.get(WINSTON_MODULE_PROVIDER) as Logger;
  const reflector = app.get(Reflector);

  app.useGlobalInterceptors(
    new LoggingInterceptor(logger),
    new ResponseInterceptor(reflector),
  );

  app.useGlobalFilters(
    new HttpExceptionFilter(),
    new AllExceptionsFilter(logger),
  );
}

bootstrap();
