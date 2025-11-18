import { Injectable, UnauthorizedException } from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import { CompanyUserRepository } from './repository/company-user.repository';
import { CreateCompanyUserDto } from './dto/create-company-user.dto';
import { UpdateCompanyUserDto } from './dto/update-company-user.dto';
import { SignupDto } from '../auth/dto/signup.dto';

@Injectable()
export class CompanyUserService {
  constructor(private readonly repo: CompanyUserRepository) {}

  async create(dto: SignupDto) {
    return this.repo.create(dto);
  }

  async findAll() {
    return this.repo.findAll();
  }

  async findByEmail(email: string) {
    return this.repo.findByEmail(email);
  }
  async findOne(id: string) {
    return this.repo.findById(id);
  }

  async update(id: string, dto: UpdateCompanyUserDto) {
    return this.repo.update(id, dto);
  }

  async remove(id: string) {
    return this.repo.remove(id);
  }

  async validateUser(email: string, password: string) {
    const user = await this.repo.findByEmail(email);
    if (!user) return null;

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return null;

    return user;
  }
}
