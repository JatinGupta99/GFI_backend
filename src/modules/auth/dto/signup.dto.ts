import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { CompanyUserRole } from '../../../common/enums/common-enums';
import { IsStrongPassword } from '../../../common/validators/isStrongPassword';

export class SignupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @IsStrongPassword()
  password: string;

  @IsEnum(CompanyUserRole)
  role: CompanyUserRole=CompanyUserRole.AGENT;
}
