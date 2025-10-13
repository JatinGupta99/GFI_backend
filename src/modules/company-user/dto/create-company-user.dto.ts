import { IsEmail, IsEnum, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CompanyUserRole } from '../../../common/enums/common-enums';

export class CreateCompanyUserDto {
  @ApiProperty({ example: 'John Doe' })
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPassword123' })
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: CompanyUserRole })
  @IsEnum(CompanyUserRole)
  role: CompanyUserRole;
}
