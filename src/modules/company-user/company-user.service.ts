import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CompanyUserRepository } from './repository/company-user.repository';
import { CreateCompanyUserDto } from './dto/create-company-user.dto';
import { UpdateCompanyUserDto } from './dto/update-company-user.dto';
import { ResetTokenType } from '../../common/enums/common-enums';
import { UserTokenService } from '../auth/user-token.service';
import { QueryCompanyUserDto } from './dto/query-company-user.dto';

@Injectable()
export class CompanyUserService {
  constructor(
    private readonly repo: CompanyUserRepository,
    private readonly userTokenService: UserTokenService,
  ) {}

  async create(dto: CreateCompanyUserDto) {
    const existing = await this.findByEmail(dto.email);
    if (existing) throw new BadRequestException('Email already exists');

    const user = await this.repo.create(dto);

    await this.userTokenService.requestToken(
      user._id.toString(),
      dto.email,
      dto.name,
      ResetTokenType.SETUP,
    );

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async findAll(query: QueryCompanyUserDto) {
    const result = await this.repo.findAll(query);

    return {
      users: result.users,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  async findByEmail(email: string) {
    return this.repo.findByEmail(email);
  }

  async findOne(id: string) {
    const user = await this.repo.findById(id);
    return { user };
  }

  async update(id: string, dto: UpdateCompanyUserDto) {
    const user = await this.repo.update(id, dto);
    return { user };
  }

  async remove(id: string) {
    await this.repo.remove(id);
    return null;
  }

  async validateUser(email: string, password: string) {
    const user = await this.repo.findByEmail(email);
    if (!user) return null;

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return null;

    return user;
  }
}
