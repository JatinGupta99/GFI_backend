import { SetMetadata } from '@nestjs/common';
import { CompanyUserRole } from '../enums/common-enums';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: CompanyUserRole[]) => SetMetadata(ROLES_KEY, roles);
