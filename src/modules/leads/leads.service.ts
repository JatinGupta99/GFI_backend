import { Injectable, NotFoundException } from '@nestjs/common';
import { FilterQuery, Types } from 'mongoose';
import { LeadStatus, SortOrder } from '../../common/enums/common-enums';
import { CreateLeadDto } from './dto/create-lead.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsRepository } from './repository/lead.repository';
import { Lead } from './schema/lead.schema';

@Injectable()
export class LeadsService {
  constructor(private readonly repo: LeadsRepository) { }

  async findAll(query: PaginationQueryDto) {
    const { page = 1, limit = 20, search, sortOrder = SortOrder.DESC, sortBy = 'createdAt' } = query;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<Lead> = {};

    if (search) {
      const q = search.trim();
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

      filter.$or = [
        { 'general.prospect': regex },
        { 'general.property': regex },
        { 'general.firstName': regex },
        { 'general.lastName': regex },
        { 'general.email': regex },
        { 'general.businessName': regex },
        { 'business.legalName': regex },
      ];
    }

    const sort: FilterQuery<Lead> = { [sortBy]: sortOrder === SortOrder.ASC ? 1 : -1 };

    const [data, total] = await Promise.all([
      this.repo.find(filter, skip, limit, sort),
      this.repo.count(filter),
    ]);
    const mapper = data.map((item) => {
      const it = item as any;
      return {
        ...it,
        id: it._id?.toString(),
        fullName: `${it.general?.firstName || ''} ${it.general?.lastName || ''}`.trim(),
      }
    })
    return {
      data: mapper,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
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

  private normalizeLeadData(
    dto: CreateLeadDto,
    userId: string,
  ): CreateLeadDto {
    const data = structuredClone(dto) as CreateLeadDto;

    data.general ??= {} as any;
    const general = data.general as any;

    const LEGACY_GENERAL_FIELD_MAP: Record<string, keyof any> = {
      firstName: 'firstName',
      lastName: 'lastName',
      email: 'email',
      cellPhone: 'cellPhone',
      workPhone: 'workPhone',
      businessName: 'businessName',
      mailingAddress: 'mailingAddress',
      suite: 'suite',
      use: 'use',
      property: 'property',
      sf: 'sf',
    };

    for (const [legacyKey, targetKey] of Object.entries(LEGACY_GENERAL_FIELD_MAP)) {
      const legacyValue = (dto as any)[legacyKey];
      if (legacyValue !== undefined && general[targetKey] === undefined) {
        general[targetKey] = legacyValue;
      }
    }

    data.createdBy = userId;

    return data;
  }

  async create(dto: CreateLeadDto, userId: string) {
    const normalizedData = this.normalizeLeadData(dto, userId);
    return this.repo.create(normalizedData);
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
