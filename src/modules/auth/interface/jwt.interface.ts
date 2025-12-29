import { CompanyUserRole } from '../../../common/enums/common-enums';

export interface JwtPayload {
  sub: string;
  email: string;
  role: CompanyUserRole;
  avatar: string;
}
