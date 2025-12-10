import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CompanyUserRole } from '../../../common/enums/common-enums';
import { IsStrongPassword } from '../../../common/validators/isStrongPassword';

export class SignupDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString({ message: 'Name must be a valid string' })
  @IsNotEmpty({ message: 'Name is required' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail({}, { message: 'Email must be valid' })
  @IsNotEmpty({ message: 'Email is required' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  email: string;

  @ApiProperty({ example: 'StrongPass@123' })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @IsStrongPassword()
  password: string;

  @ApiProperty({
    enum: CompanyUserRole,
    example: CompanyUserRole.OWNER,
  })
  @IsEnum(CompanyUserRole, { message: 'Invalid user role' })
  role: CompanyUserRole = CompanyUserRole.OWNER;
}
