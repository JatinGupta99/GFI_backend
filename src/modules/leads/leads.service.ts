import { Injectable, NotFoundException } from '@nestjs/common';
import { FilterQuery, Types } from 'mongoose';
import { LeadStatus, SortOrder } from '../../common/enums/common-enums';
import { CreateLeadDto } from './dto/create-lead.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsRepository } from './repository/lead.repository';
import { Lead } from './schema/lead.schema';
import { MailService } from '../mail/mail.service';
import { MediaService } from '../media/media.service';
import { CompanyUserService } from '../company-user/company-user.service';
import { SendLoiEmailDto, SendAppEmailDto, SendApprovalEmailDto } from './dto/send-email.dto';
import { EmailType } from '../../common/enums/common-enums';

@Injectable()
export class LeadsService {
  constructor(
    private readonly repo: LeadsRepository,
    private readonly mailService: MailService,
    private readonly mediaService: MediaService,
    private readonly companyUserService: CompanyUserService,
  ) { }

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
        { 'general.name': regex },
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

    return {
      ...found,
      id: (found as any)._id?.toString(),
      fullName: `${found.general?.firstName || ''} ${found.general?.lastName || ''}`,
    };
  }

  private normalizeLeadData(
    dto: CreateLeadDto | UpdateLeadDto,
    userId?: string,
  ): any {
    const data = structuredClone(dto) as any;

    const LEGACY_GENERAL_FIELD_MAP: Record<string, string> = {
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
      notes: 'notes',
    };

    let hasLegacyFields = false;
    const legacyData: any = {};

    for (const [legacyKey, targetKey] of Object.entries(LEGACY_GENERAL_FIELD_MAP)) {
      if (data[legacyKey] !== undefined) {
        legacyData[targetKey] = data[legacyKey];
        delete data[legacyKey];
        hasLegacyFields = true;
      }
    }

    if (hasLegacyFields) {
      data.general = {
        ...(data.general || {}),
        ...legacyData,
      };
    }

    // Split name or handle firstName/lastName within general
    if (data.general) {
      if (data.general.name && !data.general.firstName && !data.general.lastName) {
        const [first, ...rest] = data.general.name.trim().split(/\s+/);
        data.general.firstName = first || '';
        data.general.lastName = rest.join(' ') || '';
      }
    }

    if (userId) {
      data.createdBy = userId;
    }

    if (data.drafting) {
      data.current_negotiation = {
        ...(data.current_negotiation || {}),
        ...data.drafting,
      };
      delete data.drafting;
    }

    return data;
  }

  private flattenObject(obj: any, prefix = ''): any {
    return Object.keys(obj).reduce((acc: any, k: string) => {
      const pre = prefix.length ? prefix + '.' : '';
      if (
        obj[k] !== null &&
        typeof obj[k] === 'object' &&
        !Array.isArray(obj[k]) &&
        !(obj[k] instanceof Types.ObjectId) &&
        Object.keys(obj[k]).length > 0 &&
        k !== 'references' // Ensure references is treated as a single object update to handle array-to-object transition
      ) {
        Object.assign(acc, this.flattenObject(obj[k], pre + k));
      } else {
        acc[pre + k] = obj[k];
      }
      return acc;
    }, {});
  }

  async create(dto: CreateLeadDto, userId: string) {
    const normalizedData = this.normalizeLeadData(dto, userId);

    return this.repo.create(normalizedData);
  }

  async update(id: string, dto: UpdateLeadDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Lead not found');
    }

    const normalizedData = this.normalizeLeadData(dto);
    const updateQuery = this.flattenObject(normalizedData);

    const updated = await this.repo.update(id, updateQuery);
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

  async generateLoi(id: string) {
    const lead = await this.findOne(id);
    const sf = Number(lead.general?.sf) || 0;
    const rentPerSf = lead.current_negotiation?.rentPerSf || 0;
    const monthlyRent = (rentPerSf * sf) / 12;

    const round = lead.dealTerms?.rounds?.[0]?.initial?.values;
    const nnn = round?.nnn || 0;

    return {
      landlord: 'Global FI',
      tenant: lead.business?.legalName || (lead.general as any)?.businessName || lead.general?.firstName || '',
      guarantor: (lead.financial as any)?.guarantor || lead.general?.firstName || '',
      property: lead.general?.property || '',
      suite: lead.general?.suite || '',
      use: (lead.general as any)?.use || '',
      term: round?.term || '',
      sf: sf,
      baseRent: {
        year1: rentPerSf,
        year2to5Increase: lead.current_negotiation?.annInc?.toString() || '0',
      },
      estimatedExpenses: {
        text: nnn > 0 ? `$${nnn} / SF` : 'TBD',
        monthly: (nnn * sf) / 12,
        annually: nnn * sf,
      },
      monthlyRent: monthlyRent,
      options: 'TBD',
      leaseCommencementDate: round?.rcd || '',
      rentCommencementDate: lead.current_negotiation?.rcd || '',
      deliveryOfSpace: 'As-is',
      deposit: round?.nnn?.toString() || 'TBD',
      personalGuaranty: (lead.financial as any)?.guarantor || (lead.general as any)?.hasCoApplicant ? 'Yes' : 'No',
      executedBy: {
        landlord: 'Global FI',
        tenant: '',
        date: new Date().toISOString(),
      },
    };
  }

  async getLoiAttachments(id: string) {
    const lead = await this.findOne(id);
    return (lead.files || []).map((file: any) => ({
      id: file.id,
      name: file.fileName,
      size: file.fileSize,
      type: file.category === 'loi' ? 'loi' : (file.category === 'flyer' ? 'flyer' : 'other'),
      selected: false,
    }));
  }

  async sendLoiEmail(id: string, dto: SendLoiEmailDto) {
    const lead = await this.findOne(id);

    // Resolve attachment symbols to signed URLs
    const resolvedAttachments: any[] = [];
    if (dto.attachments && dto.attachments.length > 0) {
      for (const fileId of dto.attachments) {
        // Find the file in the lead's files
        const file = lead.files?.find((f: any) => f.id === fileId);
        if (file) {
          try {
            const url = await this.mediaService.generateDownloadUrl(file.id);
            resolvedAttachments.push({
              filename: file.fileName,
              path: url,
            });
          } catch (err) {
            console.error(`Failed to resolve attachment ${fileId}:`, err);
          }
        }
      }
    }

    await this.mailService.send(EmailType.GENERAL as any, {
      email: dto.to,
      cc: dto.cc,
      subject: dto.subject,
      body: dto.body,
      firstName: lead.general?.firstName?.split(' ')[0] || '',
      attachments: resolvedAttachments,
    });

    return { success: true };
  }

  async sendAppEmail(id: string, dto: SendAppEmailDto, userId: string) {
    const lead = await this.findOne(id);

    let user: any = null;
    try {
      if (userId) {
        const result = await this.companyUserService.findOne(userId);
        user = result.user;
      }
    } catch (err) {
      console.warn(`Could not fetch user ${userId} for email signature:`, err.message);
    }

    await this.mailService.send(EmailType.GENERAL as any, {
      email: dto.to,
      cc: dto.cc,
      subject: dto.subject,
      body: dto.body,
      firstName: lead.general?.firstName?.split(' ')[0] || '',
      applicationLink: dto.applicationLink,
      userName: user?.name || 'Global Fund Investments',
      userTitle: user?.role === 'LEASING' ? 'Leasing Agent' : 'Team Member',
      companyName: 'Global Fund Investments',
    });
    return { success: true };
  }

  async sendApprovalEmail(id: string, dto: SendApprovalEmailDto) {
    const lead = await this.findOne(id);
    await this.mailService.send(EmailType.GENERAL as any, {
      email: dto.to,
      cc: dto.cc,
      subject: dto.subject,
      body: dto.body,
      firstName: lead.general?.firstName?.split(' ')[0] || '',
      ...dto.payload,
    });
    return { success: true };
  }
}
