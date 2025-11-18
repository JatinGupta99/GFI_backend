import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CompanyUserService } from '../company-user/company-user.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtPayload } from './interface/jwt.interface';

@Injectable()
export class AuthService {
  private readonly jwtExpiresIn: string;

  constructor(
    private readonly companyUserService: CompanyUserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '1h';
  }

  async signup(dto: SignupDto) {
    const existing = await this.companyUserService.findByEmail(dto.email);
    if (existing) throw new BadRequestException('Email already exists');
    const user = await this.companyUserService.create({
      ...dto,
      password: dto.password,
    });

    return {
      message: 'User registered successfully',
      user: { id: user._id, email: user.email, role: user.role },
    };
  }

  async login(loginDetails: LoginDto) {
    const user = await this.companyUserService.findByEmail(loginDetails.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(loginDetails.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const payload: JwtPayload = {
      sub: (user._id as string).toString(),
      email: user.email,
      role: user.role,
      avatar: user.avatar,
    };

    const access_token = this.jwtService.sign(payload, {
      expiresIn: this.jwtExpiresIn,
    });

    return {
      access_token,
      expires_in: this.parseExpiresIn(this.jwtExpiresIn),
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    };
  }

  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/(\d+)([smhd])/);
    if (!match) return 3600;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 3600;
    }
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.companyUserService.findByEmail(dto.email);
    if (!user) throw new NotFoundException('User not found');

    const resetToken = this.jwtService.sign(
      { sub: user._id, email: user.email },
      { expiresIn: '15m' },
    );

    // TODO: Send email with this token (using MailService)
    // Example: await this.mailService.sendPasswordReset(user.email, resetToken);

    return {
      message: 'Password reset link sent to your email',
      resetToken,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    try {
      const payload = this.jwtService.verify(dto.token);
      const user = await this.companyUserService.findByEmail(payload.email);
      if (!user) throw new NotFoundException('User not found');

      const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
      await this.companyUserService.update(user._id as string, {
        password: hashedPassword,
      });

      return { message: 'Password updated successfully' };
    } catch (err) {
      throw new BadRequestException('Invalid or expired token');
    }
  }
}
