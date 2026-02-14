import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { UserRole } from '../../../common/enums/common-enums';

export class CreateCompanyUserDto {
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

  @ApiProperty({
    enum: UserRole,
    example: UserRole.VIEWER,
  })
  @IsEnum(UserRole, { message: 'Invalid user role' })
  role: UserRole = UserRole.VIEWER;

  @ApiProperty({ example: ['008400'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  properties?: string[];

}
