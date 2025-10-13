import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CompanyUserService } from '../company-user/company-user.service';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly jwtExpiresIn: string;

  constructor(
    private readonly userService: CompanyUserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtExpiresIn =
      this.configService.get<string>('JWT_EXPIRES_IN') || '1h';
  }

  async login(email: string, password: string) {
    const user = (await this.userService.findByEmail(email)) as {
      _id: Types.ObjectId;
      email: string;
      password: string;
      role: string;
    };
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };
    const access_token = this.jwtService.sign(payload, {
      expiresIn: this.jwtExpiresIn,
    });

    return {
      access_token,
      expires_in: this.parseExpiresIn(this.jwtExpiresIn),
    };
  }

  private parseExpiresIn(expiresIn: string): number {
    // Convert '1h', '30m', '2d' → seconds
    const match = expiresIn.match(/(\d+)([smhd])/);
    if (!match) return 3600; // default 1h

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
}
