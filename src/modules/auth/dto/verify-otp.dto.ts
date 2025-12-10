import { IsEmail, IsNotEmpty, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class VerifyOtpDto {
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Enter a valid email address' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  email: string;

  @IsNotEmpty({ message: 'OTP is required' })
  @Matches(/^\d+$/, { message: 'OTP should contain only digits' })
  @Length(4, 4, { message: 'OTP must be exactly 4 digits' })
  otp: string;
}
