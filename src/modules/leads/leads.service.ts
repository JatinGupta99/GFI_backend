import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException, Logger } from '@nestjs/common';
import { FilterQuery, Types } from 'mongoose';
import { ActivityType, JOBNAME, LeadStatus, Role, SortOrder } from '../../common/enums/common-enums';
import { CreateLeadDto } from './dto/create-lead.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateLeadPublicDto } from './dto/update-lead-public.dto';
import { LeadsRepository } from './repository/lead.repository';
import { Lead } from './schema/lead.schema';
import { MailService } from '../mail/mail.service';
import { MediaService } from '../media/media.service';
import { CompanyUserService } from '../company-user/company-user.service';
import { ActivitiesService } from '../property-assets/activities.service';
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

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly repo: LeadsRepository,
    private readonly mailService: MailService,
    private readonly mediaService: MediaService,
    private readonly companyUserService: CompanyUserService,
    private readonly tasksService: TasksService,
    private readonly activitiesService: ActivitiesService,
    @InjectQueue(JOBNAME.LEADS_PROCESSING) private leadsQueue: Queue,
    @InjectModel(TenantFormProgress.name) private tenantFormModel: Model<TenantFormProgressDocument>,
    private readonly configService: ConfigService,
  ) { }

  async findAll(query: PaginationQueryDto) {
    const {
      page = 1,
      limit = 20,
      search,
      use,
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
      TENANT_AR_ALL: ['SEND_TO_ATTORNEY', 'SEND_COURTESY_NOTICE', 'SEND_THREE_DAY_NOTICE'],
      LEASE_ALL: ['LEASE_NEGOTIATION', 'OUT_FOR_EXECUTION', 'DRAFTING_LEASE'],
    };

    // -------------------------
    // Lead Status Filter
    // -------------------------
    // -------------------------
// Lead Status Filter
// -------------------------
if (lead_status) {
  let values: string[];

  if (lead_status === 'LEAD_ALL') {
    values = STATUS_GROUPS.LEAD_ALL;
  } else if (lead_status === 'TENANT_AR_ALL') {
    values = STATUS_GROUPS.TENANT_AR_ALL;
  } else {
    values = [lead_status];
  }

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
    // Business Category (Use) Filter
    // -------------------------
    if (use) {
      filter['general.use'] = use;
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
      meta: PaginationHelper.buildMetaFromPage(total, page, limit),
    };
  }
  /**
   * Extract filename from S3 key
   * @param key S3 key path
   * @returns Extracted filename or null
   */
  private extractFilenameFromKey(key: string): string | null {
    if (!key) return null;
    
    const parts = key.split('/');
    const filename = parts[parts.length - 1];
    
    // If filename has no extension, add .pdf
    if (filename && !filename.includes('.')) {
      return `${filename}.pdf`;
    }
    
    return filename || null;
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

  /**
   * Public API to get lead data including submission status
   * Used for public forms to check if application is already submitted
   */
  async findOnePublic(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Lead not found');
    }

    const found = await this.repo.findById(id);
    if (!found) throw new NotFoundException('Lead not found');

    return {
      success: true,
      data: {
        id: (found as any)._id?.toString(),
        business: found.business || {},
        financial: found.financial || {},
        references: found.references || {},
        general: {
          firstName: found.general?.firstName || '',
          lastName: found.general?.lastName || '',
          dob: found.general?.dob || '',
          ssn: found.general?.ssn || '',
          spouseName: found.general?.spouseName || '',
          spouseDob: found.general?.spouseDob || '',
          spouseSsn: found.general?.spouseSsn || '',
          residentialAddress: found.general?.residentialAddress || '',
          howLongAtAddress: found.general?.howLongAtAddress || '',
          presentEmployer: found.general?.presentEmployer || '',
          businessExperienceSummary: found.general?.businessExperienceSummary || '',
          hasCoApplicant: found.general?.hasCoApplicant || false,
          workPhone: found.general?.workPhone || '',
          driversLicenseUploaded: found.general?.driversLicenseUploaded || false,
          notes: found.general?.notes || '',
          applicationSubmitted: found.general?.applicationSubmitted || false,
          applicationSubmittedAt: found.general?.applicationSubmittedAt?.toISOString() || null,
        },
        files: found.files || [],
        createdAt: (found as any).createdAt?.toISOString() || null,
        updatedAt: (found as any).updatedAt?.toISOString() || null,
      }
    };
  }

  /**
   * Get submission status for a lead
   * Used by frontend to check if application can be modified
   */
  async getSubmissionStatus(leadId: string) {
    if (!Types.ObjectId.isValid(leadId)) {
      throw new NotFoundException('Lead not found');
    }

    const lead = await this.repo.findById(leadId);
    if (!lead) throw new NotFoundException('Lead not found');

    return {
      success: true,
      data: {
        isSubmitted: lead.general?.applicationSubmitted === true,
        submittedAt: lead.general?.applicationSubmittedAt?.toISOString() || null,
        canModify: lead.general?.applicationSubmitted !== true,
        leadId: leadId,
      }
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
    
    // Handle references conversion - support both array and object formats
    if (normalizedData.references) {
      if (Array.isArray(normalizedData.references)) {
        // Already an array, use as-is
        normalizedData.references = normalizedData.references;
      } else if (typeof normalizedData.references === 'object') {
        // Convert object with numeric keys to array
        const referencesObj = normalizedData.references as any;
        const numericKeys = Object.keys(referencesObj)
          .filter(key => !isNaN(Number(key))) // Only numeric keys like "0", "1", etc.
          .sort((a, b) => Number(a) - Number(b));
        
        if (numericKeys.length > 0) {
          // Object with numeric keys - convert to array
          normalizedData.references = numericKeys.map(key => referencesObj[key]);
        } else {
          // Single reference object - wrap in array
          normalizedData.references = [referencesObj];
        }
      }
    }
    
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
    
    // Handle regular attachments from lead files
    if (dto.attachments && dto.attachments.length > 0) {
      for (const fileId of dto.attachments) {
        // Find the file in the lead's files
        const file = lead.files?.find((f: any) => f.id === fileId);
        if (file) {
          try {
            // Download the file buffer instead of using signed URL
            const fileBuffer = await this.mediaService.getFileBuffer(file.id);
            resolvedAttachments.push({
              filename: file.fileName,
              content: fileBuffer,
              contentType: file.fileType || 'application/octet-stream',
            });
          } catch (err) {
            this.logger.error(`Failed to resolve attachment ${fileId}:`, err);
          }
        }
      }
    }

    // Handle PDF key attachment (LOI document)
    if (dto.Key) {
      try {
        this.logger.log(`Processing PDF key attachment: ${dto.Key}`);
        
        // Validate the key format
        if (!dto.Key.trim()) {
          throw new Error('PDF key is empty');
        }
        
        // Download the PDF buffer for email attachment
        const pdfBuffer = await this.mediaService.getFileBuffer(dto.Key);
        
        if (!pdfBuffer || pdfBuffer.length === 0) {
          throw new Error('PDF buffer is empty');
        }
        
        // Extract filename from S3 key or use default
        const filename = this.extractFilenameFromKey(dto.Key) || 'LOI-Document.pdf';
        
        // Add PDF as attachment with buffer (for direct email attachment)
        resolvedAttachments.push({
          filename: filename,
          content: pdfBuffer,
          contentType: 'application/pdf',
        });

        this.logger.log(`Successfully added PDF attachment: ${filename} (${pdfBuffer.length} bytes)`);
        
      } catch (err) {
        this.logger.error(`Failed to process PDF key ${dto.Key}:`, {
          error: err.message,
          stack: err.stack,
          key: dto.Key
        });
        // Continue without the PDF attachment rather than failing the entire email
      }
    }

    // Send the email
    this.logger.debug('Sending email with payload:', {
      to: dto.to,
      cc: dto.cc,
      subject: dto.subject,
      bodyLength: dto.body?.length || 0,
      attachmentCount: resolvedAttachments.length,
      attachments: resolvedAttachments.map(att => ({
        filename: att.filename,
        hasContent: !!att.content,
        hasPath: !!att.path,
        contentType: att.contentType
      }))
    });

    await this.mailService.send(EmailType.GENERAL as any, {
      email: dto.to,
      cc: dto.cc,
      subject: dto.subject,
      body: dto.body,
      firstName: lead.general?.firstName?.split(' ')[0] || '',
      attachments: resolvedAttachments,
    });

    // Create follow-up activity if followUpDays is provided
    let followUpActivityId: string | null = null;
    if (dto.followUpDays && dto.followUpDays > 0) {
      try {
        this.logger.log(`Creating follow-up activity for lead ${id} in ${dto.followUpDays} days`);
        
        // Calculate follow-up date
        const followUpDate = new Date();
        followUpDate.setDate(followUpDate.getDate() + dto.followUpDays);
        
        // Create follow-up activity with scheduling information
        const followUpActivity = await this.activitiesService.create(
          id,
          {
            activityName: `Follow-up: ${dto.subject}`,
            department: dto.followUpAutomatedDay ? 'Automated Follow-up' : 'Manual Follow-up',
            followUpDate: followUpDate,
            isAutomatedFollowUp: dto.followUpAutomatedDay,
            followUpCompleted: false,
            originalEmailSubject: dto.subject,
            followUpType: 'email', // Default to email follow-up
          },
          {
            userId: 'system', // System-generated activity
            name: 'System',
            email: 'system@company.com',
            role: 'SYSTEM'
          }
        );

        followUpActivityId = String(followUpActivity._id) || followUpActivity.id;
        
        this.logger.log(`Created follow-up activity ${followUpActivityId} for lead ${id}, scheduled for ${followUpDate.toISOString()}`);
        
      } catch (err) {
        this.logger.error(`Failed to create follow-up activity for lead ${id}:`, err);
        // Don't fail the email sending if activity creation fails
      }
    }

    return { 
      success: true,
      attachmentCount: resolvedAttachments.length,
      message: `Email sent successfully with ${resolvedAttachments.length} attachment(s)`,
      followUpActivityId: followUpActivityId,
      followUpDays: dto.followUpDays || null,
    };
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
    // Check if ID is a valid MongoDB ObjectId format (24 hex characters)
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    
    let lead: any = null;
    
    // Only try to fetch lead if ID is valid ObjectId format
    if (isValidObjectId) {
      try {
        lead = await this.repo.findById(id);
      } catch (error) {
        this.logger.warn(`Failed to fetch lead with ID ${id}: ${error.message}`);
        // Continue without lead data
      }
    } else {
      this.logger.warn(`Invalid ObjectId format: ${id}. Proceeding without lead data.`);
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
        lead?.general?.businessName ||
        lead?.general?.firstName ||
        'Lead';

      const property =
        lead?.general?.property ||
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
      firstName: lead?.general?.firstName?.split(' ')[0] ?? '',
      lastName: lead?.general?.lastName ?? '',
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
      key: key,
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

  /**
   * Upload LOI document and process with Document AI
   * Following SOLID principles - Single Responsibility
   * @param leadId - Lead ID
   * @param file - Uploaded file buffer
   * @param fileName - Original filename
   * @param userName - User who uploaded
   * @returns Upload result with S3 key and processing status
   */
  async uploadAndProcessLoiDocument(
    leadId: string,
    file: Buffer,
    fileName: string,
    userName: string = 'System',
  ) {
    // Validate lead exists
    const lead = await this.repo.findById(leadId);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    this.logger.log(`Uploading LOI document for lead ${leadId}: ${fileName}`);

    // Upload to S3 (DRY - reuse existing MediaService)
    const folderPath = `leads/${leadId}/loi`;
    const mimeType = 'application/pdf';
    
    const { key } = await this.mediaService.uploadFile(file, mimeType, folderPath);

    this.logger.log(`LOI document uploaded to S3: ${key}`);

    // Update lead with LOI document URL
    await this.repo.update(leadId, { loiDocumentUrl: key });

    // Queue document for AI processing (async)
    await this.leadsQueue.add(JOBNAME.PROCESS_DOCUMENT, {
      leadId,
      fileId: key,
      fileKey: key,
      mimeType,
      documentType: 'loi', // Mark as LOI for special handling
    });

    this.logger.log(`LOI document queued for processing: ${key}`);

    return {
      success: true,
      message: 'LOI document uploaded and queued for processing',
      data: {
        key,
        fileName,
        uploadedBy: userName,
        uploadedAt: new Date().toISOString(),
        processingStatus: 'PENDING',
      },
    };
  }

  /**
   * Get upload URL for LOI document (3-step upload process)
   * Following DRY principle - reuse existing pattern
   * @param leadId - Lead ID
   * @returns Presigned S3 upload URL and key
   */
  async getLoiUploadUrl(leadId: string) {
    const lead = await this.repo.findById(leadId);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const folderPath = `leads/${leadId}/loi`;
    const contentType = 'application/pdf';

    const { key, url } = await this.mediaService.generateUploadUrl(folderPath, contentType);

    return {
      statusCode: 200,
      message: 'LOI upload URL generated successfully',
      data: {
        key,
        url,
        contentType,
      },
    };
  }

  /**
   * Confirm LOI document upload and trigger processing
   * Following DRY principle - reuse existing pattern
   * @param leadId - Lead ID
   * @param key - S3 key from upload
   * @param fileName - Original filename
   * @param fileSize - File size in bytes
   * @param userName - User who uploaded
   * @returns Confirmation result
   */
  async confirmLoiUpload(
    leadId: string,
    key: string,
    fileName: string,
    fileSize: number,
    userName: string = 'System',
  ) {
    const lead = await this.repo.findById(leadId);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    this.logger.log(`Confirming LOI upload for lead ${leadId}: ${key}`);

    // Update lead with LOI document URL
    const updateResult = await this.repo.update(leadId, { loiDocumentUrl: key });
    
    if (!updateResult) {
      this.logger.error(`Failed to update lead ${leadId} with LOI document URL: ${key}`);
      throw new InternalServerErrorException('Failed to save LOI document URL to database');
    }
    
    this.logger.log(`Successfully saved LOI document URL to database: ${key}`);
    this.logger.debug(`Updated lead loiDocumentUrl field: ${updateResult.loiDocumentUrl}`);

    // Queue for Document AI processing
    await this.leadsQueue.add(JOBNAME.PROCESS_DOCUMENT, {
      leadId,
      fileId: key,
      fileKey: key,
      mimeType: 'application/pdf',
      documentType: 'loi',
    });

    this.logger.log(`LOI document confirmed and queued for processing: ${key}`);

    return {
      statusCode: 200,
      message: 'LOI document uploaded and queued for processing',
      data: {
        key,
        fileName,
        fileSize,
        uploadedBy: userName,
        uploadedAt: new Date().toISOString(),
        processingStatus: 'PENDING',
        loiDocumentUrl: key, // Include the saved URL in response
      },
    };
  }

  /**
   * Update lead with LOI extraction results
   * Following Single Responsibility Principle
   * ONLY updates current_negotiation fields, NOT general fields
   * @param leadId - Lead ID
   * @param key - S3 key of LOI document
   * @param result - Extraction result from Document AI
   */
  async updateWithLoiExtraction(leadId: string, key: string, result: any) {
    const lead = await this.repo.findById(leadId);
    if (!lead) return;

    this.logger.log(`Updating lead ${leadId} with LOI extraction results`);
    this.logger.log(`Document AI Overall Confidence: ${result.overallConfidence}`);
    
    const CONFIDENCE_THRESHOLD = 0.85;
    const data = result.data || {};
    
    // Log ALL extracted fields from Document AI
    this.logger.log(`=== Document AI Extracted Fields (${Object.keys(data).length} total) ===`);
    Object.keys(data).forEach(key => {
      const field = data[key];
      this.logger.log(`  ${key}: "${field.value}" (confidence: ${field.confidence?.toFixed(2)})`);
    });
    this.logger.log(`=== End of Extracted Fields ===`);

    // Helper to safely get value if confidence is good and non-empty
    const getValue = (field: any) => {
      if (field && field.value && field.confidence >= CONFIDENCE_THRESHOLD) {
        const value = field.value;
        // Skip empty strings, null, undefined, or 0
        if (value === '' || value === null || value === undefined || value === 0) {
          return null;
        }
        return value;
      }
      return null;
    };

    // Initialize current_negotiation if it doesn't exist
    if (!lead.current_negotiation) lead.current_negotiation = {} as any;

    // Extract and update ONLY current_negotiation fields from LOI
    const updatePayload: any = {};
    let hasUpdates = false;

    // Extract current_negotiation fields with EXACT Document AI field names
    // Document AI returns: rent_psf, annual_increase, tenant_improvement_psf, rent_commencement_date, free_rent_months, term
    const rentPerSf = getValue(data.rent_psf) || getValue(data.rent_per_sf) || getValue(data.base_rent_per_sf);
    const annInc = getValue(data.annual_increase) || getValue(data.ann_inc) || getValue(data.rent_increase);
    const freeMonths = getValue(data.free_rent_months) || getValue(data.free_months);
    const term = getValue(data.term) || getValue(data.lease_term);
    const tiPerSf = getValue(data.tenant_improvement_psf) || getValue(data.ti_per_sf) || getValue(data.tenant_improvement_per_sf);
    const rcd = getValue(data.rent_commencement_date) || getValue(data.rcd);

    // Only update fields that have non-empty values
    if (rentPerSf !== null) {
      lead.current_negotiation.rentPerSf = parseFloat(rentPerSf);
      hasUpdates = true;
      this.logger.debug(`Extracted rentPerSf: ${rentPerSf}`);
    }

    if (annInc !== null) {
      lead.current_negotiation.annInc = parseFloat(annInc);
      hasUpdates = true;
      this.logger.debug(`Extracted annInc: ${annInc}`);
    }

    if (freeMonths !== null) {
      lead.current_negotiation.freeMonths = parseFloat(freeMonths);
      hasUpdates = true;
      this.logger.debug(`Extracted freeMonths: ${freeMonths}`);
    }

    if (term !== null) {
      lead.current_negotiation.term = term;
      hasUpdates = true;
      this.logger.debug(`Extracted term: ${term}`);
    }

    if (tiPerSf !== null) {
      lead.current_negotiation.tiPerSf = parseFloat(tiPerSf);
      hasUpdates = true;
      this.logger.debug(`Extracted tiPerSf: ${tiPerSf}`);
    }

    if (rcd !== null) {
      lead.current_negotiation.rcd = rcd;
      hasUpdates = true;
      this.logger.debug(`Extracted rcd: ${rcd}`);
    }

    // Only include current_negotiation in update if we have changes
    if (hasUpdates) {
      updatePayload.current_negotiation = lead.current_negotiation;
    }

    // Store extraction metadata
    updatePayload.loiExtractionData = {
      extractedAt: new Date(),
      confidence: result.overallConfidence,
      rawData: data,
      fieldsUpdated: hasUpdates ? Object.keys(lead.current_negotiation).filter(key => 
        lead.current_negotiation[key] !== null && 
        lead.current_negotiation[key] !== undefined && 
        lead.current_negotiation[key] !== ''
      ) : [],
    };

    await this.repo.update(leadId, updatePayload);

    this.logger.log(`Lead ${leadId} updated with LOI extraction results (confidence: ${result.overallConfidence}, fields updated: ${hasUpdates})`);
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

    // Check if already submitted
    const existingLead = await this.repo.findById(leadId);
    if (!existingLead) {
      throw new NotFoundException('Lead not found');
    }

    // 🔥 CRITICAL: Prevent updates if already submitted
    if (existingLead.general?.applicationSubmitted === true) {
      throw new BadRequestException('Application has already been submitted and cannot be modified');
    }

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
    if (formData.general) {
      updatePayload.general = formData.general;
      
      // 🔥 CRITICAL: Handle submission status
      if (formData.general.applicationSubmitted === true) {
        updatePayload.general.applicationSubmitted = true;
        updatePayload.general.applicationSubmittedAt = new Date();
        
        // Log submission attempt for audit trail
        this.logger.log(`Application submitted for lead ${leadId} via token at ${new Date().toISOString()}`);
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      await this.repo.update(leadId, updatePayload);
    }

    return { 
      success: true, 
      message: updatePayload.general?.applicationSubmitted 
        ? 'Application submitted successfully' 
        : 'Form updated successfully',
      last_saved: progress.last_saved,
      tenant_id: leadId,
      applicationSubmitted: updatePayload.general?.applicationSubmitted || false,
      applicationSubmittedAt: updatePayload.general?.applicationSubmittedAt?.toISOString() || null,
    };
  }

  async submitTenantForm(token: string, dto: SubmitTenantFormDto) {
    const progress = await this.validateTenantToken(token);
    const leadId = progress.tenant_id.toString();

    // Check if already submitted
    const existingLead = await this.repo.findById(leadId);
    if (!existingLead) {
      throw new NotFoundException('Lead not found');
    }

    // 🔥 CRITICAL: Prevent duplicate submission
    if (existingLead.general?.applicationSubmitted === true) {
      throw new BadRequestException('Application has already been submitted');
    }

    const formData = { ...progress.form_data, ...dto.form_data };

    const updatePayload: any = {
      business: formData.business,
      financial: formData.financial,
      references: formData.references,
      general: {
        ...formData.general,
        // 🔥 CRITICAL: Mark as submitted
        applicationSubmitted: true,
        applicationSubmittedAt: new Date(),
      },
      form_status: FormStatus.SUBMITTED,
    };

    await this.repo.update(leadId, updatePayload);

    progress.status = FormStatus.SUBMITTED;
    progress.form_data = formData;
    progress.last_saved = new Date();
    await progress.save();

    // Log submission for audit trail
    this.logger.log(`Tenant form submitted for lead ${leadId} via token at ${new Date().toISOString()}`);

    return { 
      success: true, 
      message: 'Application submitted successfully',
      submittedAt: updatePayload.general.applicationSubmittedAt?.toISOString() || new Date().toISOString(),
    };
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
   * 🔥 INCLUDES SUBMISSION PREVENTION LOGIC
   */
  async updateLeadPublic(leadId: string, formData: UpdateLeadPublicDto) {
    if (!Types.ObjectId.isValid(leadId)) {
      throw new NotFoundException('Lead not found');
    }

    const lead = await this.repo.findById(leadId);
    if (!lead) throw new NotFoundException('Lead not found');

    // 🔥 CRITICAL: Prevent updates if already submitted
    if (lead.general?.applicationSubmitted === true) {
      throw new BadRequestException('Application has already been submitted and cannot be modified');
    }

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
        delete updatePayload.general.name;
      }

      // 🔥 CRITICAL: Handle submission status
      if (formData.general.applicationSubmitted === true) {
        updatePayload.general.applicationSubmitted = true;
        updatePayload.general.applicationSubmittedAt = new Date();
        
        // Log submission attempt for audit trail
        this.logger.log(`Application submitted for lead ${leadId} at ${new Date().toISOString()}`);
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      throw new BadRequestException('No valid fields to update');
    }

    const updated = await this.repo.update(leadId, updatePayload);

    if (!updated) {
      throw new InternalServerErrorException('Failed to update lead');
    }

    return {
      success: true,
      message: updated.general?.applicationSubmitted 
        ? 'Application submitted successfully' 
        : 'Lead updated successfully',
      data: {
        id: updated._id?.toString() || leadId,
        updatedAt: (updated as any).updatedAt?.toISOString() || new Date().toISOString(),
        applicationSubmitted: updated.general?.applicationSubmitted || false,
        applicationSubmittedAt: updated.general?.applicationSubmittedAt?.toISOString() || null,
      }
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

  /**
   * Dashboard Metrics
   */

  /**
   * Get pending approvals count and total SF
   */
  async getPendingApprovals() {
    const result = await this.repo.aggregate([
      {
        $match: {
          approval_status: { $in: ['PENDING', 'IN_REVIEW'] },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalSF: {
            $sum: {
              $convert: {
                input: '$general.sf',
                to: 'double',
                onError: 0,
                onNull: 0,
              },
            },
          },
        },
      },
    ]);

    return {
      count: result[0]?.count || 0,
      totalSF: Math.round(result[0]?.totalSF || 0),
    };
  }

  /**
   * Get pending approvals older than 2 days
   */
  async getPendingApprovalsOverTwoDays() {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const result = await this.repo.aggregate([
      {
        $addFields: {
          submittedDateConverted: {
            $cond: {
              if: { $and: [
                { $ne: ['$lease.submittedDate', null] },
                { $ne: [{ $type: '$lease.submittedDate' }, 'missing'] }
              ]},
              then: {
                $cond: {
                  if: { $eq: [{ $type: '$lease.submittedDate' }, 'string'] },
                  then: { $toDate: '$lease.submittedDate' },
                  else: '$lease.submittedDate',
                },
              },
              else: '$createdAt',
            },
          },
        },
      },
      {
        $match: {
          approval_status: { $in: ['PENDING', 'IN_REVIEW'] },
          submittedDateConverted: { $lte: twoDaysAgo },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalSF: {
            $sum: {
              $convert: {
                input: '$general.sf',
                to: 'double',
                onError: 0,
                onNull: 0,
              },
            },
          },
        },
      },
    ]);

    return {
      count: result[0]?.count || 0,
      totalSF: Math.round(result[0]?.totalSF || 0),
    };
  }

  /**
   * Get average days to approve
   */
  async getAvgDaysToApprove() {
    const result = await this.repo.aggregate([
      {
        $match: {
          approval_status: 'APPROVED',
          'lease.submittedDate': { $exists: true, $ne: null },
          'lease.approvedDate': { $exists: true, $ne: null },
        },
      },
      {
        $addFields: {
          submittedDateConverted: {
            $cond: {
              if: { $eq: [{ $type: '$lease.submittedDate' }, 'string'] },
              then: { $toDate: '$lease.submittedDate' },
              else: '$lease.submittedDate',
            },
          },
          approvedDateConverted: {
            $cond: {
              if: { $eq: [{ $type: '$lease.approvedDate' }, 'string'] },
              then: { $toDate: '$lease.approvedDate' },
              else: '$lease.approvedDate',
            },
          },
        },
      },
      {
        $project: {
          daysToApprove: {
            $divide: [
              { $subtract: ['$approvedDateConverted', '$submittedDateConverted'] },
              1000 * 60 * 60 * 24, // Convert milliseconds to days
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgDays: { $avg: '$daysToApprove' },
        },
      },
    ]);

    return Math.round(result[0]?.avgDays || 0);
  }

  /**
   * Get approved deals in the last 30 days
   */
  async getApprovedDealsLast30Days() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.repo.aggregate([
      {
        $addFields: {
          approvedDateConverted: {
            $cond: {
              if: { $and: [
                { $ne: ['$lease.approvedDate', null] },
                { $ne: [{ $type: '$lease.approvedDate' }, 'missing'] }
              ]},
              then: {
                $cond: {
                  if: { $eq: [{ $type: '$lease.approvedDate' }, 'string'] },
                  then: { $toDate: '$lease.approvedDate' },
                  else: '$lease.approvedDate',
                },
              },
              else: null,
            },
          },
        },
      },
      {
        $match: {
          approval_status: 'APPROVED',
          approvedDateConverted: { $gte: thirtyDaysAgo, $ne: null },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalSF: {
            $sum: {
              $convert: {
                input: '$general.sf',
                to: 'double',
                onError: 0,
                onNull: 0,
              },
            },
          },
        },
      },
    ]);

    return {
      count: result[0]?.count || 0,
      totalSF: Math.round(result[0]?.totalSF || 0),
    };
  }

  /**
   * Get all dashboard metrics in one call
   */
  async getDashboardMetrics() {
    try {
      const [
        pendingApprovals,
        pendingApprovalsOverTwoDays,
        avgDaysToApprove,
        approvedDealsLast30Days,
      ] = await Promise.all([
        this.getPendingApprovals(),
        this.getPendingApprovalsOverTwoDays(),
        this.getAvgDaysToApprove(),
        this.getApprovedDealsLast30Days(),
      ]);

      return {
        statusCode: 200,
        message: 'Dashboard metrics retrieved successfully',
        data: {
          pendingApprovals: {
            count: pendingApprovals.count,
            totalSF: pendingApprovals.totalSF,
          },
          pendingApprovalsOverTwoDays: {
            count: pendingApprovalsOverTwoDays.count,
            totalSF: pendingApprovalsOverTwoDays.totalSF,
          },
          avgDaysToApprove,
          approvedDealsLast30Days: {
            count: approvedDealsLast30Days.count,
            totalSF: approvedDealsLast30Days.totalSF,
          },
        },
      };
    } catch (error) {
      this.logger.error('Error fetching dashboard metrics:', error);
      throw new InternalServerErrorException('Failed to fetch dashboard metrics');
    }
  }

  /**
   * Lease Dashboard Metrics
   */

  /**
   * Get lease draft requests count
   */
  async getLeaseDraftRequests() {
    const result = await this.repo.aggregate([
      {
        $match: {
          lease_status: 'DRAFTING_LEASE',
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalSF: {
            $sum: {
              $convert: {
                input: '$general.sf',
                to: 'double',
                onError: 0,
                onNull: 0,
              },
            },
          },
        },
      },
    ]);

    return {
      count: result[0]?.count || 0,
      totalSF: Math.round(result[0]?.totalSF || 0),
    };
  }

  /**
   * Get new leases in negotiation
   */
  async getNewLeasesInNegotiation() {
    const result = await this.repo.aggregate([
      {
        $match: {
          lease_status: 'LEASE_NEGOTIATION',
          lead_status: { $nin: ['RENEWAL_NEGOTIATION', 'Renewal Negotiation'] },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalSF: {
            $sum: {
              $convert: {
                input: '$general.sf',
                to: 'double',
                onError: 0,
                onNull: 0,
              },
            },
          },
        },
      },
    ]);

    return {
      count: result[0]?.count || 0,
      totalSF: Math.round(result[0]?.totalSF || 0),
    };
  }

  /**
   * Get renewals in negotiation
   */
  async getRenewalsInNegotiation() {
    const result = await this.repo.aggregate([
      {
        $match: {
          $or: [
            { lead_status: 'RENEWAL_NEGOTIATION' },
            { lead_status: 'Renewal Negotiation' },
          ],
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalSF: {
            $sum: {
              $convert: {
                input: '$general.sf',
                to: 'double',
                onError: 0,
                onNull: 0,
              },
            },
          },
        },
      },
    ]);

    return {
      count: result[0]?.count || 0,
      totalSF: Math.round(result[0]?.totalSF || 0),
    };
  }

  /**
   * Get leases signed in the last 30 days
   */
  async getLeasesSigned30Days() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.repo.aggregate([
      {
        $addFields: {
          signedAtConverted: {
            $cond: {
              if: { $and: [
                { $ne: ['$signedAt', null] },
                { $ne: [{ $type: '$signedAt' }, 'missing'] }
              ]},
              then: {
                $cond: {
                  if: { $eq: [{ $type: '$signedAt' }, 'string'] },
                  then: { $toDate: '$signedAt' },
                  else: '$signedAt',
                },
              },
              else: null,
            },
          },
        },
      },
      {
        $match: {
          signatureStatus: 'SIGNED',
          signedAtConverted: { $gte: thirtyDaysAgo, $ne: null },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalSF: {
            $sum: {
              $convert: {
                input: '$general.sf',
                to: 'double',
                onError: 0,
                onNull: 0,
              },
            },
          },
        },
      },
    ]);

    return {
      count: result[0]?.count || 0,
      totalSF: Math.round(result[0]?.totalSF || 0),
    };
  }

  /**
   * Get all lease dashboard metrics in one call
   */
  async getLeaseDashboardMetrics() {
    try {
      const [
        leaseDraftRequests,
        newLeasesInNegotiation,
        renewalsInNegotiation,
        leasesSigned30Days,
      ] = await Promise.all([
        this.getLeaseDraftRequests(),
        this.getNewLeasesInNegotiation(),
        this.getRenewalsInNegotiation(),
        this.getLeasesSigned30Days(),
      ]);

      return {
        statusCode: 200,
        message: 'Lease dashboard metrics retrieved successfully',
        data: {
          leaseDraftRequests: {
            count: leaseDraftRequests.count,
            totalSF: leaseDraftRequests.totalSF,
          },
          newLeasesInNegotiation: {
            count: newLeasesInNegotiation.count,
            totalSF: newLeasesInNegotiation.totalSF,
          },
          renewalsInNegotiation: {
            count: renewalsInNegotiation.count,
            totalSF: renewalsInNegotiation.totalSF,
          },
          leasesSigned30Days: {
            count: leasesSigned30Days.count,
            totalSF: leasesSigned30Days.totalSF,
          },
        },
      };
    } catch (error) {
      this.logger.error('Error fetching lease dashboard metrics:', error);
      throw new InternalServerErrorException('Failed to fetch lease dashboard metrics');
    }
  }

  /**
   * Overview Metrics - Leasing Section
   */

  /**
   * Get active leads count
   */
  async getActiveLeadsCount() {
    const result = await this.repo.aggregate([
      {
        $match: {
          lead_status: { $in: ['LOI_NEGOTIATION', 'QUALIFYING', 'OUT_FOR_EXECUTION', 'Prospect'] },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
        },
      },
    ]);

    return result[0]?.count || 0;
  }

  /**
   * Get LOI negotiation count
   */
  async getLoiNegotiationCount() {
    const result = await this.repo.aggregate([
      {
        $match: {
          lead_status: 'LOI_NEGOTIATION',
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
        },
      },
    ]);

    return result[0]?.count || 0;
  }

  /**
   * Get upcoming renewals (next 90 days)
   */
  async getUpcomingRenewals() {
    // This would require a lease expiration date field
    // For now, returning count of renewals in negotiation
    const result = await this.repo.aggregate([
      {
        $match: {
          $or: [
            { lead_status: 'RENEWAL_NEGOTIATION' },
            { lead_status: 'Renewal Negotiation' },
          ],
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
        },
      },
    ]);

    return result[0]?.count || 0;
  }

  /**
   * Overview Metrics - Property Management Section
   */

  /**
   * Get tenants with AR (Accounts Receivable)
   */
  async getTenantsWithAR() {
    const result = await this.repo.aggregate([
      {
        $match: {
          'accounting.balanceDue': { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalBalance: { $sum: '$accounting.balanceDue' },
        },
      },
    ]);

    return {
      count: result[0]?.count || 0,
      totalBalance: Math.round(result[0]?.totalBalance || 0),
    };
  }

  /**
   * Get tenants with 3-day notice
   */
  async getTenantsWith3Day() {
    const result = await this.repo.aggregate([
      {
        $match: {
          lead_status: 'SEND_THREE_DAY_NOTICE',
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalBalance: { $sum: '$accounting.balanceDue' },
        },
      },
    ]);

    return {
      count: result[0]?.count || 0,
      totalBalance: Math.round(result[0]?.totalBalance || 0),
    };
  }

  /**
   * Get tenants with attorney
   */
  async getTenantsWithAttorney() {
    const result = await this.repo.aggregate([
      {
        $match: {
          lead_status: 'SEND_TO_ATTORNEY',
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalBalance: { $sum: '$accounting.balanceDue' },
        },
      },
    ]);

    return {
      count: result[0]?.count || 0,
      totalBalance: Math.round(result[0]?.totalBalance || 0),
    };
  }

  /**
   * Get tenants negotiating settlement
   */
  async getTenantsNegotiatingSettlement() {
    const result = await this.repo.aggregate([
      {
        $match: {
          lead_status: 'SEND_COURTESY_NOTICE',
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalBalance: { $sum: '$accounting.balanceDue' },
        },
      },
    ]);

    return {
      count: result[0]?.count || 0,
      totalBalance: Math.round(result[0]?.totalBalance || 0),
    };
  }

  /**
   * Get all overview metrics in one call
   */
  async getOverviewMetrics() {
    try {
      const [
        activeLeads,
        loiNegotiation,
        upcomingRenewals,
        tenantsWithAR,
        tenantsWith3Day,
        tenantsWithAttorney,
        tenantsNegotiatingSettlement,
        leaseDraftRequests,
        newLeasesInNegotiation,
        renewalsInNegotiation,
        leasesSigned30Days,
      ] = await Promise.all([
        this.getActiveLeadsCount(),
        this.getLoiNegotiationCount(),
        this.getUpcomingRenewals(),
        this.getTenantsWithAR(),
        this.getTenantsWith3Day(),
        this.getTenantsWithAttorney(),
        this.getTenantsNegotiatingSettlement(),
        this.getLeaseDraftRequests(),
        this.getNewLeasesInNegotiation(),
        this.getRenewalsInNegotiation(),
        this.getLeasesSigned30Days(),
      ]);

      // Calculate totals
      const totalARBalance = 
        tenantsWithAR.totalBalance +
        tenantsWith3Day.totalBalance +
        tenantsWithAttorney.totalBalance +
        tenantsNegotiatingSettlement.totalBalance;

      const totalSFInPipeline =
        leaseDraftRequests.totalSF +
        newLeasesInNegotiation.totalSF +
        renewalsInNegotiation.totalSF;

      const totalActiveItems =
        activeLeads +
        upcomingRenewals +
        tenantsWithAR.count +
        tenantsWith3Day.count +
        tenantsWithAttorney.count +
        tenantsNegotiatingSettlement.count;

      return {
        statusCode: 200,
        message: 'Overview metrics retrieved successfully',
        data: {
          leasing: {
            activeLeads,
            loiNegotiation,
            upcomingRenewals,
          },
          propertyManagement: {
            tenantsWithAR: {
              count: tenantsWithAR.count,
              totalBalance: tenantsWithAR.totalBalance,
            },
            tenantsWith3Day: {
              count: tenantsWith3Day.count,
              totalBalance: tenantsWith3Day.totalBalance,
            },
            tenantsWithAttorney: {
              count: tenantsWithAttorney.count,
              totalBalance: tenantsWithAttorney.totalBalance,
            },
            tenantsNegotiatingSettlement: {
              count: tenantsNegotiatingSettlement.count,
              totalBalance: tenantsNegotiatingSettlement.totalBalance,
            },
          },
          legal: {
            leaseDraftRequests: {
              count: leaseDraftRequests.count,
              totalSF: leaseDraftRequests.totalSF,
            },
            newLeasesInNegotiation: {
              count: newLeasesInNegotiation.count,
              totalSF: newLeasesInNegotiation.totalSF,
            },
            renewalsInNegotiation: {
              count: renewalsInNegotiation.count,
              totalSF: renewalsInNegotiation.totalSF,
            },
            leasesSigned30Days: {
              count: leasesSigned30Days.count,
              totalSF: leasesSigned30Days.totalSF,
            },
          },
          summary: {
            totalActiveItems,
            totalARBalance,
            totalSFInPipeline,
          },
        },
      };
    } catch (error) {
      this.logger.error('Error fetching overview metrics:', error);
      throw new InternalServerErrorException('Failed to fetch overview metrics');
    }
  }
}

