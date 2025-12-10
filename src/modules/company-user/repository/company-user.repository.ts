import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, isValidObjectId } from 'mongoose';
import { SignupDto } from '../../auth/dto/signup.dto';
import { UpdateCompanyUserDto } from '../dto/update-company-user.dto';
import { CompanyUser, CompanyUserDocument } from '../schema/company-user.schema';
import { CreateCompanyUserDto } from '../dto/create-company-user.dto';
import { QueryCompanyUserDto } from '../dto/query-company-user.dto';

@Injectable()
export class CompanyUserRepository {
  constructor(@InjectModel(CompanyUser.name) private model: Model<CompanyUserDocument>) { }

  async create(dto: CreateCompanyUserDto) {
    const user = new this.model(dto);
    return user.save();
  }

  async createWithPassword(dto: SignupDto) {
    const user = new this.model({
      ...dto,
      password: dto.password,
    });
    return user.save();
  }

  async findAll(query: QueryCompanyUserDto) {
    const {
      search = '',
      page = 1,
      limit = 10,
      sortBy = 'name',
      sortOrder = 'asc',
    } = query;

    const filter: any = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.model
        .find(filter)
        .select('-password')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string) {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid user ID');
    const user = await this.model.findById(id).select('-password').exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateCompanyUserDto) {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid user ID');

    if (dto.email) {
      const emailExists = await this.model.findOne({
        email: dto.email,
        _id: { $ne: id },
      });
      if (emailExists) throw new BadRequestException('Email already in use');
    }

    const updated = await this.model.findByIdAndUpdate(id, dto, { new: true }).select('-password');
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  async remove(id: string) {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid user ID');

    const deleted = await this.model.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException('User not found');
    return { message: 'User deleted successfully' };
  }

  async findByEmail(email: string) {
    return this.model.findOne({ email });
  }
}
