import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateCompanyUserDto } from './create-company-user.dto';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/isStrongPassword';
import { Transform } from 'class-transformer';

export class UpdateCompanyUserDto {
  @IsOptional()
  @IsString({ message: 'Password must be a string' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @IsStrongPassword()
  password?: string;

  @IsString()
  @IsOptional()
  phone_no?: string;

  @IsString()
  @IsOptional()
  avatar?: string;


  @ApiProperty({ example: 'John Doe' })
  @IsString({ message: 'Name must be a valid string' })
  @IsOptional({ message: 'Name is required' })
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail({}, { message: 'Email must be valid' })
  @IsOptional({ message: 'Email is required' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  email?: string;
}
