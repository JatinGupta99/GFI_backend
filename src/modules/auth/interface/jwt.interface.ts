import { UserRole } from '../../../common/enums/common-enums';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  avatar: string;
}
