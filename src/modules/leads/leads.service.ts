import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { FilterQuery, Types } from 'mongoose';
import { ActivityType, JOBNAME, LeadStatus, Role, SortOrder } from '../../common/enums/common-enums';
import { CreateLeadDto } from './dto/create-lead.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsRepository } from './repository/lead.repository';
import { Lead } from './schema/lead.schema';
import { MailService } from '../mail/mail.service';
import { MediaService } from '../media/media.service';
import { CompanyUserService } from '../company-user/company-user.service';
import { SendLoiEmailDto, SendAppEmailDto, SendApprovalEmailDto, SendRenewalLetterDto } from './dto/send-email.dto';
import { EmailType } from '../../common/enums/common-enums';
import { TasksService } from '../tasks/tasks.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantFormProgress, TenantFormProgressDocument } from './schema/tenant-form-progress.schema';
import { SaveTenantFormDto, SubmitTenantFormDto } from './dto/tenant-form.dto';
import { FormStatus } from '../../common/enums/common-enums';
import { ConfigService } from '@nestjs/config';



@Injectable()
export class LeadsService {
  constructor(
    private readonly repo: LeadsRepository,
    private readonly mailService: MailService,
    private readonly mediaService: MediaService,
    private readonly companyUserService: CompanyUserService,
    private readonly tasksService: TasksService,
    @InjectQueue(JOBNAME.LEADS_PROCESSING) private leadsQueue: Queue,
    @InjectModel(TenantFormProgress.name) private tenantFormModel: Model<TenantFormProgressDocument>,
    private readonly configService: ConfigService,
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
      userTitle: user?.role === Role.LEASING ? 'Leasing Agent' : 'Team Member',
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

  async sendRenewalLetter(id: string, dto: SendRenewalLetterDto) {
    const lead = await this.findOne(id);

    // Resolve attachments if any
    const resolvedAttachments: any[] = [];
    if (dto.attachments && dto.attachments.length > 0) {
      for (const fileId of dto.attachments) {
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

    // Send email
    await this.mailService.send(EmailType.GENERAL as any, {
      email: dto.to,
      cc: dto.cc,
      subject: dto.subject,
      body: dto.body,
      firstName: lead.general?.firstName?.split(' ')[0] || '',
      attachments: resolvedAttachments,
      companyName: 'Global Fund Investments',
    });

    // Create follow-up task if requested
    if (dto.addFollowUpTask) {
      const followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + (dto.followUpDays || 3));

      await this.tasksService.create({
        title: `Follow up: ${dto.subject}`,
        description: `Follow up on renewal letter sent to ${dto.to}. Lead: ${lead.general?.firstName} ${lead.general?.lastName}`,
        dueDate: followUpDate.toISOString(),
        property: lead.general?.property || '',
        priority: 'Medium',
        category: 'Leasing',
        ownerName: 'System', // Or current user if available
      } as any);
    }

    return { success: true };
  }

  async processFile(leadId: string, fileId: string) {
    const lead = await this.findOne(leadId);
    const file = lead.files?.find((f: any) => f.id === fileId);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Determine mime type based on file extension or store it in FileInfo
    // For now assuming extension check or stored type
    const mimeType = file.fileType || 'application/pdf';

    await this.leadsQueue.add(JOBNAME.PROCESS_DOCUMENT, {
      leadId,
      fileId,
      fileKey: file.id,
      mimeType,
    });

    return { success: true, message: 'Processing started' };
  }

  async updateFileStatus(leadId: string, fileId: string, status: LeadStatus) {
    // We need to use array filters to update specific element
    // MongoDB usage: 'files.$.processingStatus': status
    // But since repository pattern might be generic, let's fetch and update for now if direct set isn't easy
    // Actually standard Mongoose allows 'files.$.processingStatus' if we query by leadId AND fileId

    // For safety and simplicity with current repository wrapper:
    const lead = await this.repo.findById(leadId);
    if (!lead) return;

    const fileIndex = lead.files.findIndex((f: any) => f.id === fileId);
    if (fileIndex > -1) {
      lead.files[fileIndex].processingStatus = status;
      await this.repo.update(leadId, { files: lead.files });
    }
  }



  async addFile(leadId: string, file: any, category: string = 'other', userId: string = 'System') {
    const lead = await this.repo.findById(leadId);
    if (!lead) throw new NotFoundException('Lead not found');

    // Upload to S3
    const folder = this.mediaService.getFolderByContentType(file.mimetype);
    const { key, url } = await this.mediaService.uploadFile(file.buffer, file.mimetype, folder);

    // Create FileInfo
    const fileInfo = {
      id: key, // Using S3 key as ID for simplicity
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.mimetype,
      category,
      uploadedDate: new Date(),
      processingStatus: LeadStatus.PENDING,
      confidence: 0,
      extractedData: {},
    };

    // Update Lead
    if (!lead.files) lead.files = [];
    lead.files.push(fileInfo as any);

    // Add Activity Log
    if (!lead.activities) lead.activities = [];
    lead.activities.push({
      id: uuidv4(),
      type: ActivityType.FILE_UPLOAD,
      description: `Uploaded file: ${file.originalname} (${category})`,
      createdBy: userId,
      createdDate: new Date(),
    } as any);

    await this.repo.update(leadId, { files: lead.files, activities: lead.activities });

    // Auto-trigger processing if it's a PDF
    if (file.mimetype === 'application/pdf') {
      await this.processFile(leadId, key);
    }

    return { success: true, file: fileInfo, url, key };
  }

  async updateWithExtraction(leadId: string, fileId: string, result: any) {
    const lead = await this.repo.findById(leadId);
    if (!lead) return;

    const fileIndex = lead.files.findIndex((f: any) => f.id === fileId);
    if (fileIndex > -1) {
      // Update File Info
      lead.files[fileIndex].processingStatus = LeadStatus.PROCESSING;
      lead.files[fileIndex].confidence = result.overallConfidence;
      lead.files[fileIndex].extractedData = result.data;

      const CONFIDENCE_THRESHOLD = 0.85;
      const REVIEW_THRESHOLD = 0.6;

      const data = result.data || {};

      if (result.overallConfidence < REVIEW_THRESHOLD) {
        lead.files[fileIndex].processingStatus = LeadStatus.REVIEW_REQUIRED;
      }

      // Helper to safely get value if confidence is good
      const getValue = (field: any) => {
        if (field && field.value && field.confidence >= CONFIDENCE_THRESHOLD) {
          return field.value;
        }
        return null;
      };

      if (!lead.general) lead.general = {} as any;

      const fName = getValue(data.firstName);
      if (!lead.general.firstName && fName) lead.general.firstName = fName;

      const lName = getValue(data.lastName);
      if (!lead.general.lastName && lName) lead.general.lastName = lName;

      const email = getValue(data.email);
      if (!lead.general.email && email) lead.general.email = email;

      const phone = getValue(data.phone);
      if (!lead.general.cellPhone && phone) lead.general.cellPhone = phone;

      const company = getValue(data.company);
      if (company && !lead.general.businessName) lead.general.businessName = company;

      const updatePayload: any = {
        files: lead.files,
        general: lead.general,
        activities: lead.activities,
      };

      // Add Activity Log
      if (!lead.activities) lead.activities = [];
      lead.activities.push({
        id: uuidv4(), // standard uuid import if available, or just string
        type: ActivityType.DOC_AI_PROCESSED,
        description: `Document processed: ${lead.files[fileIndex].fileName}. Confidence: ${result.overallConfidence}`,
        createdBy: 'System',
        createdDate: new Date(),
      } as any);
      updatePayload.activities = lead.activities;

      await this.repo.update(leadId, updatePayload);
    }
  }

  async sendTenantMagicLink(leadId: string, email?: string) {
    const lead = await this.repo.findById(leadId);
    if (!lead) throw new NotFoundException('Lead not found');

    const recipientEmail = email || lead.general?.email;
    if (!recipientEmail) {
      throw new BadRequestException('No email provided for tenant form');
    }

    const token = uuidv4();
    const expiryDays = 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    let progress = await this.tenantFormModel.findOne({ tenant_id: new Types.ObjectId(leadId) });
    if (progress) {
      progress.tenant_token = token;
      progress.expiresAt = expiresAt;
      progress.status = FormStatus.CREATED;
      await progress.save();
    } else {
      progress = await this.tenantFormModel.create({
        tenant_id: new Types.ObjectId(leadId),
        tenant_token: token,
        expiresAt,
        status: FormStatus.CREATED,
        form_data: {
          business: lead.business,
          financial: lead.financial,
          references: lead.references,
          general: lead.general,
        },
      });
    }

    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    const formLink = `${frontendUrl}/apply/tenant/${leadId}?token=${token}`;

    await this.mailService.send(EmailType.GENERAL as any, {
      // email: dto.to,
      // cc: dto.cc,
      // subject: dto.subject,
      // body: dto.body,
      // firstName: lead.general?.firstName?.split(' ')[0] || '',
      // applicationLink: dto.applicationLink,
      // userName: user?.name || 'Global Fund Investments',
      // userTitle: user?.role === Role.LEASING ? 'Leasing Agent' : 'Team Member',
      // companyName: 'Global Fund Investments',
      email: recipientEmail,
      subject: 'Complete Your Lease Application',
      body: `
        <p>Dear ${lead.general?.firstName || 'Tenant'},</p>
        <p>Your lease application magic link is ready. Use the link below to start or resume your application. This link will expire in ${expiryDays} days.</p>
        <p><a href="${formLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Resume Application</a></p>
        <p>Best regards,<br>Global Fund Investments</p>
      `,
    });

    return { success: true, message: 'Magic link sent', token };
  }

  private async validateTenantToken(token: string): Promise<TenantFormProgressDocument> {
    const progress = await this.tenantFormModel.findOne({ tenant_token: token });
    if (!progress) {
      throw new UnauthorizedException('Invalid magic link');
    }

    if (new Date() > progress.expiresAt) {
      throw new UnauthorizedException('Magic link has expired');
    }

    if (progress.status === FormStatus.SUBMITTED) {
      throw new BadRequestException('Application has already been submitted');
    }

    return progress;
  }

  async getTenantForm(token: string) {
    const progress = await this.validateTenantToken(token);
    return { success: true, form_data: progress.form_data, status: progress.status };
  }

  async saveTenantForm(token: string, dto: SaveTenantFormDto) {
    const progress = await this.validateTenantToken(token);

    // Merge logic: Overwrite sections or full payload
    progress.form_data = { ...progress.form_data, ...dto.form_data };
    progress.status = FormStatus.IN_PROGRESS;
    progress.last_saved = new Date();

    await progress.save();
    return { success: true, last_saved: progress.last_saved };
  }

  async submitTenantForm(token: string, dto: SubmitTenantFormDto) {
    const progress = await this.validateTenantToken(token);

    const formData = { ...progress.form_data, ...dto.form_data };
    const leadId = progress.tenant_id.toString();

    // 1. Update Lead record (Final Table)
    const updatePayload: any = {
      business: formData.business,
      financial: formData.financial,
      references: formData.references,
      general: formData.general,
      form_status: FormStatus.SUBMITTED,
    };

    await this.repo.update(leadId, updatePayload);

    // 2. Mark progress as SUBMITTED
    progress.status = FormStatus.SUBMITTED;
    progress.form_data = formData;
    progress.last_saved = new Date();
    await progress.save();

    // 3. Add Activity Log to Lead
    const lead = await this.repo.findById(leadId);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    if (!lead.activities) lead.activities = [];
    lead.activities.push({
      id: uuidv4(),
      type: ActivityType.NOTE,
      description: 'Tenant Application Submitted via Magic Link',
      createdBy: 'Tenant',
      createdDate: new Date(),
    } as any);
    await this.repo.update(leadId, { activities: lead.activities });

    return { success: true, message: 'Application submitted successfully' };
  }
}
