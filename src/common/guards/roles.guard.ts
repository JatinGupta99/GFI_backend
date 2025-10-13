import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { CompanyUserRole } from '../enums/common-enums';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Get the required roles from the @Roles decorator
    const requiredRoles = this.reflector.getAllAndOverride<CompanyUserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If a route has no @Roles decorator, we'll allow access
    if (!requiredRoles) {
      return true;
    }

    // 2. Get the user object from the request.
    // This user object is attached by the JwtAuthGuard which runs before this guard.
    const { user } = context.switchToHttp().getRequest();

    // If there's no user (e.g., a public route somehow got this guard), deny access.
    if (!user) {
      return false;
    }

    // 3. Compare the user's roles with the required roles.
    // The request is allowed if the user has at least one of the required roles.
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
