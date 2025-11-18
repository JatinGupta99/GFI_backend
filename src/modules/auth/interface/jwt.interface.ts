import { CompanyUserRole } from "../../../common/enums/common-enums";

export interface JwtPayload {
  _id?: string;
  sub: string;
  email: string;
  role: CompanyUserRole;
  avatar?: string;
}

