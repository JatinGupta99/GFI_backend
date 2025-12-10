import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { ResetTokenType } from '../../common/enums/common-enums';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignupDto } from './dto/signup.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Controller('auth')
@Public()
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('signup')
  @ResponseMessage('User registered successfully')
  signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @Post('login')
  @ResponseMessage('OTP sent to your email. Please verify to complete login.')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('forgot-password')
  @ResponseMessage('If an account exists, a reset link has been sent')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @ResponseMessage('Password reset successfully')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto, ResetTokenType.RESET);
  }

  @Post('setup-password')
  @ResponseMessage('Password setup successfully')
  setupPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto, ResetTokenType.SETUP);
  }

  @Post('request-otp')
  @ResponseMessage('OTP sent successfully')
  sendOtp(@Body() email: string) {
    return this.authService.sendOtp(email);
  }

  @Post('verify-otp')
  @ResponseMessage('OTP verified successfully')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }
}
