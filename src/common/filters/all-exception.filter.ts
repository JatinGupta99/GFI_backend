import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger } from 'winston';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;

    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException
      ? exception.getResponse()
      : 'Internal server error';

    const { message, errors } = this.extractMessage(exceptionResponse);

    // Logging for monitoring/ELK/Grafana/Sentry
    this.logger.error({
      status,
      message,
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      stack: exception instanceof Error ? exception.stack : null,
    });

    return response.status(status).json({
      status: 'error',
      statusCode: status,
      message,
      errors,
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
    });
  }

  private extractMessage(response: any) {
    let message = 'Unexpected error';
    let errors: any = null;

    if (typeof response === 'string') {
      message = response;
    } else if (response?.message) {
      // message can be: string | string[]
      message = Array.isArray(response.message)
        ? 'Validation failed'
        : response.message;
      errors = Array.isArray(response.message) ? response.message : null;
    }

    return { message, errors };
  }
}
