import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ResponseBuilder } from '../helpers/response.builder';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // If already formatted with 'status' property, return as-is
        if (data && typeof data === 'object' && 'status' in data) {
          return data;
        }

        // Get custom message from decorator or use default
        const message =
          this.reflector.get<string>(
            RESPONSE_MESSAGE_KEY,
            context.getHandler(),
          ) || this.getDefaultMessage(context);

        // Wrap response
        return ResponseBuilder.success(message, data);
      }),
    );
  }

  private getDefaultMessage(context: ExecutionContext): string {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Smart default messages based on HTTP method
    switch (method) {
      case 'POST':
        return 'Resource created successfully';
      case 'PUT':
      case 'PATCH':
        return 'Resource updated successfully';
      case 'DELETE':
        return 'Resource deleted successfully';
      case 'GET':
      default:
        return 'Request completed successfully';
    }
  }
}
