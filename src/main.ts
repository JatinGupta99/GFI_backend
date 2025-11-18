import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global API prefix
  app.setGlobalPrefix('api');

  app.enableCors({
    origin: ['http://localhost:4000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  // Setup Swagger
  setupSwagger(app);

  // Setup global middlewares
  setupGlobalMiddlewares(app);

  const logger = app.get<Logger>(WINSTON_MODULE_PROVIDER);
  const port = process.env.PORT ?? 4000;
  await app.listen(port);

  logger.info(`🚀 Server running at http://localhost:${port}/api`);
  logger.info(`📘 Swagger docs available at http://localhost:${port}/docs`);
}

function setupSwagger(app: any) {
  const config = new DocumentBuilder()
    .setTitle('Virtual Events Platform API')
    .setDescription('API documentation for Virtual Events Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
}

function setupGlobalMiddlewares(app: any) {
  // Validation pipe globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global logging interceptor using Winston logger
  const logger = app.get(WINSTON_MODULE_PROVIDER) as Logger;
  app.useGlobalInterceptors(new LoggingInterceptor(logger), new TransformInterceptor());

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());
}

bootstrap();
