import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lead, LeadDocument } from '../schema/lead.schema';
import { CreateLeadDto } from '../dto/create-lead.dto';
import { UpdateLeadDto } from '../dto/update-lead.dto';
import { LeadStatus } from '../../../common/enums/common-enums';

@Injectable()
export class LeadsRepository {
  constructor(
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
  ) {}

  async find(filter: any, skip: number, limit: number) {
    return this.leadModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();
  }

  async count(filter: any) {
    return this.leadModel.countDocuments(filter).exec();
  }

  async findById(id: string) {
    return this.leadModel.findById(id).lean().exec();
  }

  async create(dto: CreateLeadDto) {
    const created = await this.leadModel.create(dto);
    return created.toObject();
  }

  async update(id: string, dto: UpdateLeadDto) {
    return this.leadModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .lean()
      .exec();
  }

  async delete(id: string) {
    return this.leadModel.findByIdAndDelete(id).lean().exec();
  }

  async bulkUpdateStatus(ids: Types.ObjectId[], status: LeadStatus) {
    return this.leadModel
      .updateMany({ _id: { $in: ids } }, { $set: { status } })
      .exec();
  }
}
