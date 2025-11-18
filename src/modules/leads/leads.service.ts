import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { LeadStatus } from '../../common/enums/common-enums';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsRepository } from './repository/lead.repository';

@Injectable()
export class LeadsService {
  constructor(private readonly repo: LeadsRepository) {}

  async findAll(query: any) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (query.search) {
      const q = query.search.trim();
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { property: regex },
        { businessName: regex },
      ];
    }

    const [items, total] = await Promise.all([
      this.repo.find(filter, skip, limit),
      this.repo.count(filter),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Lead not found');
    }

    const found = await this.repo.findById(id);
    if (!found) throw new NotFoundException('Lead not found');

    return found;
  }

  async create(dto: CreateLeadDto) {
    return this.repo.create(dto);
  }

  async update(id: string, dto: UpdateLeadDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Lead not found');
    }

    const updated = await this.repo.update(id, dto);
    if (!updated) throw new NotFoundException('Lead not found');

    return updated;
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Lead not found');
    }

    const removed = await this.repo.delete(id);
    if (!removed) throw new NotFoundException('Lead not found');

    return { deleted: true };
  }

  async bulkUpdateStatus(ids: string[], status: LeadStatus) {
    const validIds = ids
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    return this.repo.bulkUpdateStatus(validIds, status);
  }
}
