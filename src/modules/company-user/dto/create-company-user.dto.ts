import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { CompanyUserRole } from '../../../common/enums/common-enums';

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
    enum: CompanyUserRole,
    example: CompanyUserRole.OWNER,
  })
  @IsEnum(CompanyUserRole, { message: 'Invalid user role' })
  role: CompanyUserRole = CompanyUserRole.OWNER;

  @IsString()
  @IsNotEmpty()
  properties: string;
}
