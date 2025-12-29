import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

interface ApiResponse<T> {
  message?: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((result: T | ApiResponse<T>) => {
        // If controller already returned { message, data }, use it
        if (result && typeof result === 'object' && 'data' in result) {
          const wrapper = result as ApiResponse<T>;
          return {
            statusCode: context.switchToHttp().getResponse().statusCode,
            message: wrapper.message,
            data: wrapper.data,
          };
        }

        // Otherwise, wrap raw result
        return {
          statusCode: context.switchToHttp().getResponse().statusCode,
          message: undefined, // no message if controller didn't provide
          data: result,
        };
      }),
    );
  }
}
