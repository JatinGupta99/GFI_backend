import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    // Assuming you have an auth guard that adds `req.user` after JWT validation
    return request.user?.id || null;
  },
);
