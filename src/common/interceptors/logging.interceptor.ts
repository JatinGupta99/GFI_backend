import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { Logger } from 'winston';
import { Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const { method, originalUrl, params, query, body } = request;

    // Exclude sensitive fields (like password)
    const sanitizedBody = { ...body };
    if (sanitizedBody.password) sanitizedBody.password = '***';

    this.logger.info(`📩 Incoming Request`, {
      method,
      url: originalUrl,
      params,
      query,
      body: sanitizedBody,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const responseTime = Date.now() - now;
          this.logger.info(`✅ Response Sent`, {
            method,
            url: originalUrl,
            statusCode: response.statusCode,
            responseTime: `${responseTime}ms`,
          });
        },
        error: (err) => {
          const responseTime = Date.now() - now;
          this.logger.error(`❌ Request Failed`, {
            method,
            url: originalUrl,
            statusCode: err?.status || 500,
            message: err?.message || 'Unknown error',
            stack: err?.stack,
            responseTime: `${responseTime}ms`,
          });
        },
      }),
    );
  }
}
