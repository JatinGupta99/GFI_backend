import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException, Logger } from '@nestjs/common';
import { FilterQuery, Types } from 'mongoose';
import { ActivityType, JOBNAME, LeadStatus, Role, SortOrder } from '../../common/enums/common-enums';
import { CreateLeadDto } from './dto/create-lead.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateLeadPublicDto } from './dto/update-lead-public.dto';
import { LeadsRepository } from './repository/lead.repository';
import { Lead } from './schema/lead.schema';
import { MailService } from '../mail/mail.service';
import { MediaService } from '../media/media.service';
import { CompanyUserService } from '../company-user/company-user.service';
import { SendLoiEmailDto, SendAppEmailDto, SendApprovalEmailDto, SendRenewalLetterDto, SendTenantMagicLinkDto } from './dto/send-email.dto';
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
import * as crypto from 'crypto';

export const COMPANY = {
  NAME: 'Global Fund Investments',
}

// Status group mapping for filtering
const LEASE_STATUS_GROUPS: Record<string, string[]> = {
  APPROVAL_ALL: ['PENDING', 'IN_REVIEW'],
  LEASE_ALL: ['LEASE_NEGOTIATION', 'OUT_FOR_EXECUTION', 'DRAFTING_LEASE'],
};

// Lead status group mapping for filtering
const LEAD_STATUS_GROUPS: Record<string, string[]> = {
  TENANT_AR_ALL: ['SEND_TO_ATTORNEY', 'SEND_COURTESY_NOTICE', 'SEND_THREE_DAY_NOTICE'],
  LEAD_FOR_ALL: ['LOI_NEGOTIATION', 'LEASE_NEGOTIATION', 'QUALIFYING', 'OUT_FOR_EXECUTION'],
};

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

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
    const {
      page = 1,
      limit = 20,
      search,
      sortOrder = SortOrder.DESC,
      sortBy = 'createdAt',
      lead_status,
      approval_status,
      lease_status,
      property,
    } = query;

    const skip = (page - 1) * limit;
    const filter: FilterQuery<Lead> = {};

    // -------------------------
    // Status Group Definitions
    // -------------------------
    const STATUS_GROUPS = {
      LEAD_ALL: ['LOI_NEGOTIATION', 'QUALIFYING', 'OUT_FOR_EXECUTION','Prospect'],
      APPROVAL_ALL: ['IN_REVIEW', 'PENDING'],
      LEASE_ALL: ['LEASE_NEGOTIATION', 'OUT_FOR_EXECUTION', 'DRAFTING_LEASE'],
    };

    // -------------------------
    // Lead Status Filter
    // -------------------------
    if (lead_status) {
      const values =
        lead_status === 'LEAD_ALL'
          ? STATUS_GROUPS.LEAD_ALL
          : [lead_status];

      filter.lead_status = { $in: values };
    }

    // -------------------------
    // Approval Status Filter
    // -------------------------
    if (approval_status) {
      const values =
        approval_status === 'APPROVAL_ALL'
          ? STATUS_GROUPS.APPROVAL_ALL
          : [approval_status];

      filter.approval_status = { $in: values };
    }

    // -------------------------
    // Lease Status Filter
    // -------------------------
    if (lease_status) {
      const values =
        lease_status === 'LEASE_ALL'
          ? STATUS_GROUPS.LEASE_ALL
          : [lease_status];

      filter.lease_status = { $in: values };
    }

    // -------------------------
    // Property Filter
    // -------------------------
    if (property) {
      filter['general.property'] = new RegExp(
        property.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i'
      );
    }

    // -------------------------
    // Search Filter
    // -------------------------
    if (search) {
      const regex = new RegExp(
        search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i'
      );

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
    console.log(filter,'caslnasclknacsl')
    const sort: FilterQuery<Lead> = {
      [sortBy]: sortOrder === SortOrder.ASC ? 1 : -1,
    };

    const [data, total] = await Promise.all([
      this.repo.find(filter, skip, limit, sort),
      this.repo.count(filter),
    ]);

    return {
      data: data.map((item: any) => ({
        ...item,
        id: item._id?.toString(),
        fullName: `${item.general?.firstName || ''} ${item.general?.lastName || ''}`.trim(),
      })),
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

    const round = lead.dealTerms?.rounds?.[0]?.initial;
    const nnn = round?.nnn || 0;

    return {
      landlord: 'Global Realty & Management FL',
      tenant: lead.general?.firstName +''+lead.general.lastName|| '',
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
      userName: user?.name || '',
      userTitle: user.role,
      companyName: COMPANY.NAME,
    });
    return { success: true };
  }

  async sendApprovalEmail(
    id: string,
    dto: SendApprovalEmailDto,
    user: {
      userId: string;
      name: string;
      role: string;
      email: string;
    },
  ) {
    const lead = await this.repo.findById(id);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    // Best-effort user lookup (do not block email)
    if (user?.userId) {
      try {
        await this.companyUserService.findOne(user.userId);
      } catch (err: any) {
        console.warn(
          `Could not fetch user ${user.userId} for email signature:`,
          err?.message,
        );
      }
    }

    /* ------------------ Subject ------------------ */

    let subject = dto.subject?.trim();

    if (!subject || subject.includes('undefined')) {
      const prospect =
        lead.general?.businessName ||
        lead.general?.firstName ||
        'Lead';

      const property =
        lead.general?.property ||
        'Property';

      subject = `Approval Request for ${prospect} Deal Terms at ${property}`;
    }

    /* ------------------ Body extraction ------------------ */

    const bodyMetadata =
      typeof dto.body === 'object' && dto.body !== null ? dto.body : {};

    let bodyContent =
      typeof dto.body === 'string' ? dto.body : '';

    if (
      !bodyContent &&
      typeof dto.body === 'object' &&
      (dto.body as any)?.formBody
    ) {
      const fb = (dto.body as any).formBody;
      bodyContent =
        typeof fb === 'string'
          ? fb.trim()
          : fb?.body?.trim() || '';
    }

    /* ------------------ Send ------------------ */

    await this.mailService.send(EmailType.GENERAL, {
      ...dto.payload,
      email: dto.to,
      cc: dto.cc ?? [],
      subject,
      body: bodyContent,
      firstName: lead.general?.firstName?.split(' ')[0] ?? '',
      lastName: lead.general?.lastName ?? '',
      userName: bodyMetadata?.loggedin_name ?? user?.name,
      userTitle:
        bodyMetadata?.loggedin_role ??
        (user?.role === Role.LEASING ? 'Leasing Agent' : 'Team Member'),
      companyName:
        bodyMetadata?.loggedin_co_name ?? 'Global Fund Investments',
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
      id: key,
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

    await this.repo.update(leadId, { files: lead.files });

    // Auto-trigger processing if it's a PDF
    if (file.mimetype === 'application/pdf') {
      await this.processFile(leadId, key);

    }

    return { success: true, file: fileInfo, url, key };
  }

  async getFileUploadUrl(leadId: string, contentType: string, category: string = 'other') {
    const lead = await this.repo.findById(leadId);
    if (!lead) throw new NotFoundException('Lead not found');

    // Pass only the folder path, media service will generate the key with UUID
    const folderPath = `leads/${leadId}/files`;

    const { key, url } = await this.mediaService.generateUploadUrl(folderPath, contentType);

    return {
      statusCode: 200,
      message: 'Upload URL generated successfully',
      data: {
        key,
        url,
        category,
      },
    };
  }

  async confirmFileUpload(
    leadId: string,
    key: string,
    fileName: string,
    fileSize: number,
    fileType: string,
    category: string = 'other',
    userName: string = 'System',
  ) {
    const lead = await this.repo.findById(leadId);
    if (!lead) throw new NotFoundException('Lead not found');

    // Create FileInfo
    const fileInfo = {
      id: key,
      fileName,
      fileSize,
      fileType,
      category,
      uploadedBy: userName,
      uploadedDate: new Date(),
      updatedBy: userName,
      updatedAt: new Date(),
      processingStatus: LeadStatus.PENDING,
      confidence: 0,
      extractedData: {},
    };

    // Update Lead
    if (!lead.files) lead.files = [];
    lead.files.push(fileInfo as any);

    await this.repo.update(leadId, { files: lead.files });

    // Auto-trigger processing if it's a PDF
    if (fileType === 'application/pdf') {
      await this.processFile(leadId, key);
    }

    return {
      statusCode: 200,
      message: 'File uploaded successfully',
      data: fileInfo,
    };
  }

  async getFileDownloadUrl(key: string) {
    const url = await this.mediaService.generateDownloadUrl(key);
    return {
      statusCode: 200,
      message: 'Download URL generated successfully',
      data: { url },
    };
  }

  async deleteFile(leadId: string, fileKey: string) {
    const lead = await this.repo.findById(leadId);
    if (!lead) throw new NotFoundException('Lead not found');

    // Find and remove file from lead's files array
    const fileIndex = lead.files?.findIndex(f => f.key === fileKey || f.id === fileKey);
    if (fileIndex === -1 || fileIndex === undefined) {
      throw new NotFoundException('File not found in lead');
    }

    const file = lead.files[fileIndex];
    const s3Key = file.key || file.id;

    // Remove from array
    lead.files.splice(fileIndex, 1);
    await this.repo.update(leadId, { files: lead.files });

    // Delete from S3
    try {
      await this.mediaService.deleteFile(s3Key);
    } catch (error) {
      console.log(error);
    }

    return {
      statusCode: 200,
      message: 'File deleted successfully',
      data: { fileKey: s3Key },
    };
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
      };

      await this.repo.update(leadId, updatePayload);
    }
  }

  async sendTenantMagicLink(leadId: string, dto: SendTenantMagicLinkDto) {
    const lead = await this.repo.findById(leadId);
    if (!lead) throw new NotFoundException('Lead not found');

    const recipientEmail = dto.email || lead.general?.email;
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

    /* ------------------ Body extraction ------------------ */

    let body = typeof dto.body === 'string' ? dto.body : '';

    if (
      !body &&
      typeof dto.body === 'object' &&
      (dto.body as any)?.formBody
    ) {
      const fb = (dto.body as any).formBody;
      body =
        typeof fb === 'string'
          ? fb.trim()
          : fb?.body?.trim() || '';
    }

    if (body) {
      body = body.replace(/{{magic_link}}/g, formLink);
      body = body.replace(/{{expiry_days}}/g, expiryDays.toString());
      body = body.replace(/{{tenant_name}}/g, lead.general?.firstName || 'Tenant');
    } else {
      body = `
        <p>Dear ${lead.general?.firstName || 'Tenant'},</p>
        <p>Your lease application magic link is ready. Use the link below to start or resume your application. This link will expire in ${expiryDays} days.</p>
        <p><a href="${formLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Resume Application</a></p>
        <p>Best regards,<br>Global Fund Investments</p>
      `;
    }

    await this.mailService.send(EmailType.GENERAL as any, {
      email: recipientEmail,
      cc: dto.cc,
      subject: dto.subject || 'Complete Your Lease Application',
      body,
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

    progress.form_data = { ...progress.form_data, ...dto.form_data };
    progress.status = FormStatus.IN_PROGRESS;
    progress.last_saved = new Date();

    await progress.save();
    return { success: true, last_saved: progress.last_saved };
  }

  async updateTenantForm(token: string, formData: any) {
    const progress = await this.validateTenantToken(token);
    const leadId = progress.tenant_id.toString();

    // Update the form_data in TenantFormProgress
    progress.form_data = { ...progress.form_data, ...formData };
    progress.status = FormStatus.IN_PROGRESS;
    progress.last_saved = new Date();
    await progress.save();

    // Also update the lead record with the same data
    const updatePayload: any = {};
    if (formData.business) updatePayload.business = formData.business;
    if (formData.financial) updatePayload.financial = formData.financial;
    if (formData.references) updatePayload.references = formData.references;
    if (formData.general) updatePayload.general = formData.general;

    if (Object.keys(updatePayload).length > 0) {
      await this.repo.update(leadId, updatePayload);
    }

    return { 
      success: true, 
      message: 'Form updated successfully',
      last_saved: progress.last_saved,
      tenant_id: leadId
    };
  }

  async submitTenantForm(token: string, dto: SubmitTenantFormDto) {
    const progress = await this.validateTenantToken(token);

    const formData = { ...progress.form_data, ...dto.form_data };
    const leadId = progress.tenant_id.toString();

    const updatePayload: any = {
      business: formData.business,
      financial: formData.financial,
      references: formData.references,
      general: formData.general,
      form_status: FormStatus.SUBMITTED,
    };

    await this.repo.update(leadId, updatePayload);

    progress.status = FormStatus.SUBMITTED;
    progress.form_data = formData;
    progress.last_saved = new Date();
    await progress.save();

    const lead = await this.repo.findById(leadId);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return { success: true, message: 'Application submitted successfully' };
  }

  /**
   * Generate upload URL for document with specific type
   * The document type will be included in the S3 key path
   */
  async getDocumentUploadUrl(leadId: string, documentType: string, contentType: string) {
    const lead = await this.repo.findById(leadId);
    if (!lead) throw new NotFoundException('Lead not found');

    // Validate content type is PDF
    if (contentType !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }

    // Create folder path with document type
    const folderPath = `leads/${leadId}/documents/${documentType}`;

    const { key, url } = await this.mediaService.generateUploadUrl(folderPath, contentType);

    return {
      statusCode: 200,
      message: 'Upload URL generated successfully',
      data: {
        key,
        url,
        documentType,
      },
    };
  }

  /**
   * Public API to update lead details without authentication
   * Used for public forms where users update their information
   */
  async updateLeadPublic(leadId: string, formData: UpdateLeadPublicDto) {
    if (!Types.ObjectId.isValid(leadId)) {
      throw new NotFoundException('Lead not found');
    }

    const lead = await this.repo.findById(leadId);
    if (!lead) throw new NotFoundException('Lead not found');

    // Build update payload with proper merging
    const updatePayload: any = {};
    
    if (formData.business) {
      updatePayload.business = { ...(lead.business || {}), ...formData.business };
    }
    
    if (formData.financial) {
      updatePayload.financial = {
        ...(lead.financial || {}),
        ...formData.financial,
        // Merge nested assets and liabilities
        assets: formData.financial.assets 
          ? { ...(lead.financial?.assets || {}), ...formData.financial.assets }
          : lead.financial?.assets,
        liabilities: formData.financial.liabilities
          ? { ...(lead.financial?.liabilities || {}), ...formData.financial.liabilities }
          : lead.financial?.liabilities,
      };
    }
    
    if (formData.references) {
      updatePayload.references = { ...(lead.references || {}), ...formData.references };
    }
    
    // Handle general field with name splitting and merging
    if (formData.general) {
      updatePayload.general = { ...(lead.general || {}), ...formData.general };
      
      // If name field exists, split it into firstName and lastName
      if (formData.general.name) {
        const nameParts = formData.general.name.trim().split(/\s+/);
        updatePayload.general.firstName = nameParts[0] || '';
        updatePayload.general.lastName = nameParts.slice(1).join(' ') || '';
        // Remove the name field as it's not in the schema
        delete updatePayload.general.name;
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      throw new BadRequestException('No valid fields to update');
    }

    const updated = await this.repo.update(leadId, updatePayload);

    return {
      success: true,
      message: 'Lead updated successfully',
      data: updated
    };
  }

  /**
   * Confirm document upload and store metadata in lead
   */
  async confirmDocumentUpload(
    leadId: string,
    key: string,
    fileName: string,
    documentType: string,
    userName: string = 'System',
  ) {
    const lead = await this.repo.findById(leadId);
    if (!lead) throw new NotFoundException('Lead not found');

    // Create document info
    const documentInfo = {
      id: key,
      fileName,
      fileType: 'application/pdf',
      documentType,
      uploadedBy: userName,
      uploadedDate: new Date(),
      updatedBy: userName,
      updatedAt: new Date(),
    };

    // Update Lead - add to files array
    if (!lead.files) lead.files = [];
    lead.files.push(documentInfo as any);

    await this.repo.update(leadId, { files: lead.files });

    return {
      statusCode: 200,
      message: 'Document uploaded successfully',
      data: documentInfo,
    };
  }
}

