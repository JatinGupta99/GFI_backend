import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import * as bcrypt from 'bcrypt';
import {
  CompanyUser,
  CompanyUserDocument,
} from '../schema/company-user.schema';
import { CreateCompanyUserDto } from '../dto/create-company-user.dto';
import { UpdateCompanyUserDto } from '../dto/update-company-user.dto';

@Injectable()
export class CompanyUserRepository {
  constructor(
    @InjectModel(CompanyUser.name) private model: Model<CompanyUserDocument>,
  ) {}

  async create(dto: CreateCompanyUserDto) {
    const exists = await this.model.findOne({ email: dto.email });
    if (exists) throw new BadRequestException('Email already exists');
    const user = new this.model(dto);
    return user.save();
  }

  async findAll() {
    return this.model.find().select('-password').exec();
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

    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 12);
    }

    const updated = await this.model
      .findByIdAndUpdate(id, dto, { new: true })
      .select('-password');
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
