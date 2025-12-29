import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'sample@mail.com',
    description: 'Registered email address',
  })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Email is invalid' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  email: string;

  @ApiProperty({
    example: 'Test@12345',
    description: 'Password for the account',
  })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString({ message: 'Password must be a valid string' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;
}

export class LoginResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR...',
  })
  access_token: string;

  @ApiProperty({
    example: 3600,
    description: 'Token validity in seconds',
  })
  expires_in: number;
}
