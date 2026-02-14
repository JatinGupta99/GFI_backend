import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ResetTokenType } from '../../common/enums/common-enums';
import { CompanyUserRepository } from '../company-user/repository/company-user.repository';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignupDto } from './dto/signup.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { UserResetToken } from './schema/user-reset-token.schema';
import { UserTokenService } from './user-token.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtExpiresIn: string;

  constructor(
    private readonly companyUserRepo: CompanyUserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userTokenService: UserTokenService,
  ) {
    this.jwtExpiresIn =
      this.configService.get<string>('JWT_EXPIRES_IN') || '1h';
  }

  async signup(dto: SignupDto) {
    const existing = await this.companyUserRepo.findByEmail(dto.email);
    if (existing) throw new BadRequestException('Email already exists');

    const user = await this.companyUserRepo.createWithPassword(dto);

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        properties: user.properties,
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.companyUserRepo.findByEmail(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.userTokenService.sendOtp(
      user._id.toString(),
      user.email,
      user.name,
    );

    return { email: user.email };
  }

  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/(\d+)([smhd])/);
    if (!match) return 3600;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    return unit === 's'
      ? value
      : unit === 'm'
        ? value * 60
        : unit === 'h'
          ? value * 3600
          : value * 86400;
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.companyUserRepo.findByEmail(dto.email);
    if (!user) {
      return null;
    }

    await this.userTokenService.requestToken(
      user._id.toString(),
      user.email,
      user.name,
      ResetTokenType.RESET,
    );

    return null;
  }

  async resetPassword(dto: ResetPasswordDto, type: ResetTokenType) {
    const tokenRecord = (await this.userTokenService.validateToken(
      dto.token,
      type,
    )) as UserResetToken;
    const user = await this.companyUserRepo.findByEmail(tokenRecord.email);
    if (!user) throw new NotFoundException('User not found');

    await this.companyUserRepo.update(user._id.toString(), {
      password: dto.newPassword,

    });
    await this.userTokenService.markTokenUsed(tokenRecord._id.toString(), type);

    return null;
  }

  async sendOtp(email: string) {
    const user = await this.companyUserRepo.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');

    return this.userTokenService.sendOtp(
      user._id.toString(),
      user.email,
      user.name,
    );
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const { otp, email } = dto;
    await this.userTokenService.verifyOtp(otp, email);

    const user = await this.companyUserRepo.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');

    const payload = {
      sub: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      properties: user.properties,
    };

    const access_token = this.jwtService.sign(payload);

    return { access_token };
  }
}
