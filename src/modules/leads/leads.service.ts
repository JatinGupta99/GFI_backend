import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { FilterQuery, Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { EmailType, FormStatus, JOBNAME, LeadStatus, RenewalStatus, Role, SortOrder } from '../../common/enums/common-enums';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { CompanyUserService } from '../company-user/company-user.service';
import { MailService } from '../mail/mail.service';
import { MediaService } from '../media/media.service';
import { PropertiesService } from '../properties/properties.service';
import { ActivitiesService } from '../property-assets/activities.service';
import { RenewalRepository } from '../renewals/repositories/renewal.repository';
import { SuiteRepository } from '../suites/repository/suite.repository';
import { TaskPriority } from '../tasks/schema/task.schema';
import { TasksService } from '../tasks/tasks.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { SendAppEmailDto, SendApprovalEmailDto, SendLoiEmailDto, SendRenewalLetterDto, SendTenantMagicLinkDto } from './dto/send-email.dto';
import { SendGenericEmailDto } from './dto/send-generic-email.dto';
import { SaveTenantFormDto, SubmitTenantFormDto } from './dto/tenant-form.dto';
import { UpdateLeadPublicDto } from './dto/update-lead-public.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsRepository } from './repository/lead.repository';
import { Lead } from './schema/lead.schema';
import { TenantFormProgress, TenantFormProgressDocument } from './schema/tenant-form-progress.schema';

export const COMPANY = {
  NAME: 'Global Fund Investments',
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly repo: LeadsRepository,
    private readonly renewalrepo: RenewalRepository,
    private readonly mailService: MailService,
    private readonly mediaService: MediaService,
    private readonly companyUserService: CompanyUserService,
    private readonly propertiesService: PropertiesService,
    private readonly tasksService: TasksService,
    private readonly activitiesService: ActivitiesService,
    private readonly suiteRepository: SuiteRepository,
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
      property,
      propertyIds,
      approved,
    } = query;

    // Parse propertyIds - handle both array and comma-separated string
    let parsedPropertyIds: string[] | undefined;
    if (propertyIds) {
      if (Array.isArray(propertyIds)) {
        parsedPropertyIds = propertyIds;
      } else if (typeof propertyIds === 'string') {
        // Split comma-separated string and trim whitespace
        parsedPropertyIds = propertyIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
      }
    }

    const skip = (page - 1) * limit;
    const filter: FilterQuery<Lead> = {};

    // -------------------------
    // Status Group Definitions
    // -------------------------
    const STATUS_GROUPS = {
      LEAD_ALL: ['LOI_NEGOTIATION', 'QUALIFYING','LEASE_NEGOTIATION','LEASE_EXECUTED', 'OUT_FOR_EXECUTION','DRAFTING_LEASE','DEAD'],
      APPROVAL_ALL: ['IN_REVIEW', 'PENDING'],
      TENANT_AR_ALL: ['SEND_ATTORNEY_NOTICE', 'SEND_COURTESY_NOTICE', 'SEND_THREE_DAY_NOTICE'],
      LEASE_ALL: ['LEASE_NEGOTIATION', 'OUT_FOR_EXECUTION', 'DRAFTING_LEASE'],
      RENEWAL_ALL: ['DRAFTING_AMENDMENT', 'OUT_FOR_EXECUTION', 'DRAFTING_LEASE','DEAD','NO_CONTACT','AMENDMENT_EXECUTED'],
    };

    // -------------------------
    // Lead Status Filter
    // -------------------------
    if (lead_status) {
      const values: string[] =
        lead_status === 'LEAD_ALL'
          ? STATUS_GROUPS.LEAD_ALL
          : lead_status === 'TENANT_AR_ALL'
            ? STATUS_GROUPS.TENANT_AR_ALL
            : lead_status.split(',').map((s: string) => s.trim()).filter(Boolean);

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
    // Property Filter (by propertyId or propertyIds array)
    // -------------------------
    if (parsedPropertyIds && parsedPropertyIds.length > 0) {
      // Filter by multiple propertyIds
      filter.propertyId = { $in: parsedPropertyIds };
      this.logger.log(`Filtering leads by propertyIds: ${parsedPropertyIds.join(', ')}`);
    } else if (property) {
      // Filter by propertyId at root level only (legacy support)
      const propertyIdValue = property.trim();
      filter.propertyId = propertyIdValue;
      this.logger.log(`Filtering leads by propertyId: ${propertyIdValue}`);
    }

    // -------------------------
    // Business Category (Use) Filter
    // -------------------------
    if (use) {
      filter['general.use'] = use;
    }

    // -------------------------
    // Approved Filter
    // -------------------------
    if (typeof approved === 'boolean') {
      filter.approved = approved;
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

    // Convert property name to propertyId
    if (dto.general?.property) {
      const propertyInput = dto.general.property as string;
      
      // Look up property by name
      const property = await this.propertiesService.findByName(propertyInput);
      
      if (property) {
        // Store property NAME in general.property (e.g., "Richwood")
        normalizedData['general.property'] = property.propertyName;
        
        // Store propertyId at root level (e.g., "008400")
        normalizedData.propertyId = property.propertyId;
        
        this.logger.log(`Property "${propertyInput}" → propertyId: ${property.propertyId}, propertyName: ${property.propertyName}`);
      } else {
        this.logger.warn(`Property not found: ${propertyInput}`);
      }
    }

    // Populate budget_negotiation from suite data ONLY if suite exists in DB
    // (meaning a budget file was uploaded for it). Otherwise use DTO values as-is.
    const suiteId = dto.general?.suite;
    const resolvedPropertyId = normalizedData.propertyId || (dto as any).propertyId;
    if (suiteId && resolvedPropertyId) {
      const suite = await this.suiteRepository.findBySuiteId(resolvedPropertyId, suiteId);
      if (suite) {
        // Suite found — budget file was uploaded, populate from suite data
        this.logger.log(`Budget file data found for suite ${suiteId} — populating budget_negotiation`);
        this.logger.log(`Suite data: baseRentPerSf="${suite.baseRentPerSf}", tiPerSf="${suite.tiPerSf}", rcd="${suite.rcd}"`);
        
        const parsedRentPerSf = suite.baseRentPerSf ? parseFloat(suite.baseRentPerSf) : 0;
        this.logger.log(`Parsed rentPerSf: ${parsedRentPerSf} (from baseRentPerSf: "${suite.baseRentPerSf}")`);
        
        normalizedData.budget_negotiation = {
          rentPerSf: parsedRentPerSf,
          annInc: normalizedData.budget_negotiation?.annInc ?? 3,
          freeMonths: normalizedData.budget_negotiation?.freeMonths ?? 0,
          term: normalizedData.budget_negotiation?.term ?? 0,
          tiPerSf: suite.tiPerSf ?? '0',
          rcd: suite.rcd ?? '',
        };
      } else {
        // No suite in DB — no budget file uploaded, use DTO values as-is
        this.logger.log(`No budget file found for suite ${suiteId} — using DTO budget_negotiation values`);
      }
    }

    // Apply defaults only for any fields still missing
    normalizedData.budget_negotiation = {
      rentPerSf: normalizedData.budget_negotiation?.rentPerSf ?? 0,
      annInc: normalizedData.budget_negotiation?.annInc ?? 3,
      freeMonths: normalizedData.budget_negotiation?.freeMonths ?? 0,
      term: normalizedData.budget_negotiation?.term ?? 0,
      tiPerSf: normalizedData.budget_negotiation?.tiPerSf ?? 0,
      rcd: normalizedData.budget_negotiation?.rcd ?? '',
    };

    return this.repo.create(normalizedData);
  }

  async update(id: string, dto: UpdateLeadDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Lead not found');
    }

    const normalizedData = this.normalizeLeadData(dto);

    // Resolve general.property name → propertyId whenever property is sent in the DTO
    if (dto.general?.property) {
      const property = await this.propertiesService.findByName(dto.general.property as string);
      if (property) {
        if (!normalizedData.general) normalizedData.general = {};
        normalizedData.general.property = property.propertyName;
        normalizedData.propertyId = property.propertyId;
        this.logger.log(`Property "${dto.general.property}" → propertyId: ${property.propertyId}, propertyName: ${property.propertyName}`);
      } else {
        this.logger.warn(`Property not found: ${dto.general.property}`);
      }
    }
    
    // Handle budget_negotiation defaults
    if (normalizedData.budget_negotiation) {
      normalizedData.budget_negotiation = {
        rentPerSf: normalizedData.budget_negotiation.rentPerSf ?? 0,
        annInc: normalizedData.budget_negotiation.annInc ?? 3,  // Default to 3
        freeMonths: normalizedData.budget_negotiation.freeMonths ?? 0,  // Default to 0
        term: normalizedData.budget_negotiation.term ?? 0,
        tiPerSf: normalizedData.budget_negotiation.tiPerSf ?? 0,
        rcd: normalizedData.budget_negotiation.rcd ?? '',
      };
    }

    // If suite is being set/changed and budget file was uploaded (suite exists in DB),
    // populate budget_negotiation from suite. Otherwise use DTO values as-is.
    const updateSuiteId = dto.general?.suite;
    const updatePropertyId = normalizedData.propertyId || (dto as any).propertyId;
    if (updateSuiteId && updatePropertyId) {
      const suite = await this.suiteRepository.findBySuiteId(updatePropertyId, updateSuiteId);
      if (suite) {
        // Suite found — budget file was uploaded, override budget_negotiation from suite
        this.logger.log(`Budget file data found for suite ${updateSuiteId} — populating budget_negotiation on update`);
        normalizedData.budget_negotiation = {
          rentPerSf: suite.baseRentPerSf ? parseFloat(suite.baseRentPerSf) : (normalizedData.budget_negotiation?.rentPerSf ?? 0),
          annInc: normalizedData.budget_negotiation?.annInc ?? 3,
          freeMonths: normalizedData.budget_negotiation?.freeMonths ?? 0,
          term: normalizedData.budget_negotiation?.term ?? 0,
          tiPerSf: suite.tiPerSf ?? normalizedData.budget_negotiation?.tiPerSf ?? '0',
          rcd: suite.rcd ?? normalizedData.budget_negotiation?.rcd ?? '',
        };
      }
      // else: no suite in DB, no budget file uploaded — keep DTO values unchanged
    }
    
    // Map budget_sheet to accounting if present
    if ((dto as any).budget_sheet) {
      const budgetSheet = (dto as any).budget_sheet;
      
      normalizedData.accounting = {
        ...(normalizedData.accounting || {}),
        // Map charges
        baseRent: budgetSheet.charges?.baseRentMonth || 0,
        cam: budgetSheet.charges?.camMonth || 0,
        ins: budgetSheet.charges?.insMonth || 0,
        tax: budgetSheet.charges?.taxMonth || 0,
        totalDue: budgetSheet.charges?.totalDueMonth || 0,
        balanceDue: budgetSheet.balanceDue || 0,
        // Map lease terms
        rentDueDate: budgetSheet.leaseTerms?.rentDueDate || '',
        lateAfter: budgetSheet.leaseTerms?.lateAfter || '',
        lateFee: budgetSheet.leaseTerms?.lateFee || 0,
        // Map monthly payments to annualPMT
        annualPMT: {
          janPmt: budgetSheet.monthlyPayments?.jan || 0,
          febPmt: budgetSheet.monthlyPayments?.feb || 0,
          marPmt: budgetSheet.monthlyPayments?.mar || 0,
          aprPmt: budgetSheet.monthlyPayments?.apr || 0,
          mayPmt: budgetSheet.monthlyPayments?.may || 0,
          junPmt: budgetSheet.monthlyPayments?.jun || 0,
          julPmt: budgetSheet.monthlyPayments?.jul || 0,
          augPmt: budgetSheet.monthlyPayments?.aug || 0,
          septPmt: budgetSheet.monthlyPayments?.sept || 0,
          octPmt: budgetSheet.monthlyPayments?.oct || 0,
          novPmt: budgetSheet.monthlyPayments?.nov || 0,
          decPmt: budgetSheet.monthlyPayments?.dec || 0,
        },
      };
      
      // Remove budget_sheet from normalized data so it doesn't get saved
      delete (normalizedData as any).budget_sheet;
    }
    
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

  async submitForApproval(id: string, submittedBy: string, submittedTo: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Lead not found');
    }

    const lead = await this.repo.findById(id);
    if (!lead) throw new NotFoundException('Lead not found');

    const dateSubmitted = new Date();
    
    const updateData = {
      lease: {
        ...(lead.lease || {}),
        submittedBy,
        submittedTo,
        dateSubmitted,
        daysWaiting: 0,
        approved: null,
      },
    } as any;

    const updated = await this.repo.update(id, updateData);
    if (!updated) throw new NotFoundException('Failed to submit for approval');

    return {
      success: true,
      message: 'Lead submitted for approval successfully',
      data: updated,
    };
  }

  async approveOrReject(id: string, approved: boolean, approvedBy: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Lead not found');
    }

    const lead = await this.repo.findById(id);
    if (!lead) throw new NotFoundException('Lead not found');

    if (!lead.lease?.dateSubmitted) {
      throw new BadRequestException('Lead has not been submitted for approval yet');
    }

    const dateApproved = new Date();
    const dateSubmitted = new Date(lead.lease.dateSubmitted);
    
    // Calculate days to approve (difference in days)
    const daysToApprove = Math.floor(
      (dateApproved.getTime() - dateSubmitted.getTime()) / (1000 * 60 * 60 * 24)
    );

    const updateData = {
      lease: {
        ...(lead.lease || {}),
        approved,
        dateApproved,
        daysToApprove,
        daysWaiting: daysToApprove,
      },
    } as any;

    const updated = await this.repo.update(id, updateData);
    if (!updated) throw new NotFoundException('Failed to update approval status');

    return {
      success: true,
      message: approved ? 'Lead approved successfully' : 'Lead rejected successfully',
      data: updated,
    };
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

  async sendGenericEmail(dto: SendGenericEmailDto) {
    // Validate and fetch record (Lead or Renewal)
    const record = await this.validateAndFetchRecord(dto.leadId, dto.recordType);
    
    // Update status based on email type
    await this.updateRecordStatusByEmailType(dto.leadId, dto.emailType, dto.recordType);
    
    // Resolve all attachments
    const resolvedAttachments = await this.resolveEmailAttachments(dto.Key, dto.attachments);
    
    // Send the email
    await this.mailService.send(EmailType.GENERAL as any, {
      email: dto.to,
      cc: dto.cc || [],
      subject: dto.subject,
      body: dto.body,
      firstName: `${dto.firstName || ''} ${dto.lastName || ''}`.trim(),
      attachments: resolvedAttachments,
    });

    // Create follow-up activity if requested
    const followUpActivityId = await this.createFollowUpActivity(dto);

    return {
      success: true,
      attachmentCount: resolvedAttachments.length,
      message: `Email sent successfully with ${resolvedAttachments.length} attachment(s)`,
      followUpActivityId: followUpActivityId,
      followUpDays: dto.followUpDays || null,
      emailType: dto.emailType || 'GENERAL',
      recordType: dto.recordType || 'LEAD',
      statusUpdated: !!dto.emailType,
    };
  }

  /**
   * Validate and fetch record (Lead or Renewal)
   */
  private async validateAndFetchRecord(id: string, recordType?: string): Promise<any> {
    if (!id) {
      throw new BadRequestException('Record ID is required');
    }

    // Default to LEAD if not specified
    const type = recordType || 'LEAD';

    if (type === 'RENEWAL') {
      // Check if renewal exists
      const renewal = await this.renewalrepo.findOne(id);
      if (!renewal) {
        throw new NotFoundException(`Renewal with ID ${id} not found`);
      }
      return renewal;
    } else {
      // Check if lead exists (LEAD or LEASE)
      const lead = await this.repo.findById(id);
      if (!lead) {
        throw new NotFoundException(`Lead with ID ${id} not found`);
      }
      return lead;
    }
  }

  /**
   * Update record status based on email type
   */
  private async updateRecordStatusByEmailType(
    id: string,
    emailType?: string,
    recordType?: string,
  ): Promise<void> {
    if (!emailType) return;

    const type = recordType || 'LEAD';
    
    // Map email types to status values
    const emailTypeToStatusMap: Record<string, string> = {
      COURTESY_NOTICE: 'SEND_COURTESY_NOTICE',
      THREE_DAY_NOTICE: 'SEND_THREE_DAY_NOTICE',
      ATTORNEY_NOTICE: 'SEND_ATTORNEY_NOTICE',
    };

    const newStatus = emailTypeToStatusMap[emailType];
    if (!newStatus) {
      this.logger.debug(`No status mapping for email type: ${emailType}`);
      return;
    }

    try {
      if (type === 'RENEWAL') {
        // Update renewal status - cast string to RenewalStatus enum
        await this.renewalrepo.updateRenewal(id, { status: newStatus as RenewalStatus });
        this.logger.log(`Updated renewal ${id} status to ${newStatus}`);
      } else {
        // Update lead status (LEAD or LEASE)
        await this.repo.update(id, { lead_status: newStatus as LeadStatus });
        this.logger.log(`Updated lead ${id} status to ${newStatus}`);
      }
    } catch (error) {
      this.logger.error(`Failed to update status for ${type} ${id}:`, error);
      // Don't throw - email should still be sent even if status update fails
    }
  }

  /**
   * Resolve all email attachments (Key + attachments array)
   */
  private async resolveEmailAttachments(
    mainKey?: string,
    attachmentKeys?: string[],
  ): Promise<any[]> {
    const resolvedAttachments: any[] = [];

    // Handle main PDF attachment (Key field)
    if (mainKey) {
      const mainAttachment = await this.resolveAttachment(mainKey, 'application/pdf');
      if (mainAttachment) {
        resolvedAttachments.push(mainAttachment);
      }
    }

    // Handle additional attachments
    if (attachmentKeys && attachmentKeys.length > 0) {
      for (const fileKey of attachmentKeys) {
        const attachment = await this.resolveAttachment(fileKey);
        if (attachment) {
          resolvedAttachments.push(attachment);
        }
      }
    }

    return resolvedAttachments;
  }

  /**
   * Resolve a single attachment from S3
   */
  private async resolveAttachment(
    fileKey: string,
    contentType: string = 'application/octet-stream',
  ): Promise<any | null> {
    try {
      if (!fileKey || !fileKey.trim()) {
        throw new Error('File key is empty');
      }

      this.logger.debug(`Resolving attachment: ${fileKey}`);

      const fileBuffer = await this.mediaService.getFileBuffer(fileKey);

      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error('File buffer is empty');
      }

      const filename = this.extractFilenameFromKey(fileKey) || 'attachment';

      this.logger.debug(`Resolved attachment: ${filename} (${fileBuffer.length} bytes)`);

      return {
        filename,
        content: fileBuffer,
        contentType,
      };
    } catch (error) {
      this.logger.error(`Failed to resolve attachment ${fileKey}:`, {
        error: error.message,
        key: fileKey,
      });
      return null;
    }
  }

  /**
   * Create follow-up activity if requested
   */
  private async createFollowUpActivity(dto: SendGenericEmailDto): Promise<string | null> {
    if (!dto.followUpDays || dto.followUpDays <= 0 || !dto.leadId) {
      return null;
    }

    try {
      this.logger.log(
        `Creating follow-up activity for ${dto.recordType || 'LEAD'} ${dto.leadId} in ${dto.followUpDays} days`,
      );

      const followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + dto.followUpDays);

      const followUpActivity = await this.activitiesService.create(
        dto.leadId,
        {
          activityName: `Follow-up: ${dto.subject}`,
          department: dto.followUpAutomatedDay
            ? 'Automated Follow-up'
            : 'Manual Follow-up',
          followUpDate: followUpDate,
          isAutomatedFollowUp: dto.followUpAutomatedDay,
          followUpCompleted: false,
          originalEmailSubject: dto.subject,
          followUpType: 'email',
        },
        {
          userId: 'system',
          name: 'System',
          email: 'system@company.com',
          role: 'SYSTEM',
        },
      );

      const activityId = String(followUpActivity._id) || followUpActivity.id;

      this.logger.log(
        `Created follow-up activity ${activityId}, scheduled for ${followUpDate.toISOString()}`,
      );

      return activityId;
    } catch (error) {
      this.logger.error(
        `Failed to create follow-up activity for ${dto.leadId}:`,
        error,
      );
      return null;
    }
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

  async sendRenewalLetter(id: string, dto: SendRenewalLetterDto,user: { userId: string; email: string; name: string; role: string }) {
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

      await this.tasksService.create(
        {
          title: `Follow up: ${dto.subject}`,
          description: `Follow up on renewal letter sent to ${dto.to}. Lead: ${lead.general?.firstName} ${lead.general?.lastName}`,
          dueDate: followUpDate,
          property: lead.general?.property || '',
          priority: TaskPriority.MEDIUM,
        },
        user.userId, // userId - system-generated task
        user.name, // userName
      );
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
    // const lead = await this.repo.findById(leadId);
    // if (!lead) throw new NotFoundException('Lead not found');

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

      const CONFIDENCE_THRESHOLD = 0.40;
      const REVIEW_THRESHOLD = 0.40;

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

      // Placeholder values set by frontend during PDF upload — treat as empty
      const PLACEHOLDER_FIRST = ['file', ''];
      const PLACEHOLDER_LAST = ['upload', ''];
      const isPlaceholderFirst = PLACEHOLDER_FIRST.includes((lead.general.firstName || '').toLowerCase());
      const isPlaceholderLast = PLACEHOLDER_LAST.includes((lead.general.lastName || '').toLowerCase());

      const fName = getValue(data.firstName);
      if ((isPlaceholderFirst || !lead.general.firstName) && fName) lead.general.firstName = fName;

      const lName = getValue(data.lastName);
      if ((isPlaceholderLast || !lead.general.lastName) && lName) lead.general.lastName = lName;

      // tenantName like "Michelle Stor" — split into first/last if individual names not found
      const tenantName = getValue(data.tenantName) || getValue(data.tenant_name);
      if (tenantName && (isPlaceholderFirst || isPlaceholderLast || !lead.general.firstName || !lead.general.lastName)) {
        const parts = tenantName.trim().split(/\s+/);
        if (isPlaceholderFirst || !lead.general.firstName) lead.general.firstName = parts[0] || '';
        if (isPlaceholderLast || !lead.general.lastName) lead.general.lastName = parts.slice(1).join(' ') || '';
      }

      const email = getValue(data.email);
      if (!lead.general.email && email) lead.general.email = email;

      const phone = getValue(data.phone);
      if (!lead.general.cellPhone && phone) lead.general.cellPhone = phone;

      const company = getValue(data.company);
      if (company && !lead.general.businessName) lead.general.businessName = company;

      const suite = getValue(data.suite);
      if (suite && !lead.general.suite) lead.general.suite = suite;

      const use = getValue(data.use) || getValue(data.permitted_use);
      if (use && !lead.general.use) lead.general.use = use;

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
  async getLoiUploadUrl(leadId: string, contentType: string = 'application/pdf') {
    const lead = await this.repo.findById(leadId);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const SUPPORTED_LOI_TYPES = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg',
      'image/tiff',
    ];

    if (!SUPPORTED_LOI_TYPES.includes(contentType)) {
      throw new BadRequestException(
        `Unsupported file type "${contentType}". Allowed: PDF, Word (.docx), or image files.`,
      );
    }

    const folderPath = `leads/${leadId}/loi`;
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
  /**
   * Detect MIME type from S3 key / file name extension.
   * Returns null for formats Document AI cannot process.
   */
  private getMimeTypeFromKey(key: string): string | null {
    const ext = key.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      pdf:  'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc:  'application/msword',
      png:  'image/png',
      jpg:  'image/jpeg',
      jpeg: 'image/jpeg',
      tiff: 'image/tiff',
      tif:  'image/tiff',
      gif:  'image/gif',
      bmp:  'image/bmp',
      webp: 'image/webp',
    };
    return map[ext ?? ''] ?? null;
  }

  async confirmLoiUpload(
    leadId: string,
    key: string,
    fileName: string,
    fileSize: number,
    userName: string = 'System',
    mimeType?: string,
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
    const detectedMime = mimeType || this.getMimeTypeFromKey(key);
    if (!detectedMime) {
      throw new BadRequestException(
        `Unsupported file format for Document AI. Please upload a PDF, Word (.docx), or image file.`,
      );
    }

    await this.leadsQueue.add(JOBNAME.PROCESS_DOCUMENT, {
      leadId,
      fileId: key,
      fileKey: key,
      mimeType: detectedMime,
      documentType: 'loi',
    });

    this.logger.log(`LOI document confirmed and queued for processing: ${key} (mimeType: ${detectedMime})`);

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
    
    const CONFIDENCE_THRESHOLD = 0.40;
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

    // Helper for TI values
    const getTIValue = (field: any) => {
      const TI_CONFIDENCE_THRESHOLD = 0.40;
      if (field && field.value && field.confidence >= TI_CONFIDENCE_THRESHOLD) {
        const value = field.value;
        // Skip empty strings, null, undefined, or 0
        if (value === '' || value === null || value === undefined || value === 0) {
          return null;
        }
        return value;
      }
      return null;
    };

    // Helper for RCD values
    const getRCDValue = (field: any) => {
      const RCD_CONFIDENCE_THRESHOLD = 0.40;
      if (field && field.value && field.confidence >= RCD_CONFIDENCE_THRESHOLD) {
        const value = field.value;
        // Skip empty strings, null, undefined, or 0
        if (value === '' || value === null || value === undefined || value === 0) {
          return null;
        }
        return value;
      }
      return null;
    };

    // Helper for Annual Increase values
    const getAnnIncValue = (field: any) => {
      const ANN_INC_CONFIDENCE_THRESHOLD = 0.40;
      if (field && field.value && field.confidence >= ANN_INC_CONFIDENCE_THRESHOLD) {
        const value = field.value;
        // Skip empty strings, null, undefined, or 0
        if (value === '' || value === null || value === undefined || value === 0) {
          return null;
        }
        return value;
      }
      return null;
    };

    // Helper to convert date to YY/MM/DD format
    const convertDateToYYMMDD = (dateString: string): string => {
      try {
        // First, try to parse as a regular date
        let date = new Date(dateString);
        
        // If it's not a valid date, check if it contains day count text
        if (isNaN(date.getTime())) {
          let daysToAdd: number | null = null;
          
          // Look for ANY number in the text (most flexible approach)
          // This will catch 120, 121, 122, etc. anywhere in the text
          const anyNumberMatch = dateString.match(/\b(\d{1,4})\b/);
          if (anyNumberMatch) {
            const foundNumber = parseInt(anyNumberMatch[1]);
            // Only use numbers that make sense as days (1-3650, roughly 10 years max)
            if (foundNumber >= 1 && foundNumber <= 3650) {
              daysToAdd = foundNumber;
              this.logger.debug(`Found number ${foundNumber} in text, treating as days to add`);
            }
          }
          
          // If no reasonable number found, try specific patterns
          if (!daysToAdd) {
            const dayPatterns = [
              /(\d+)\s*days?\s*after/i,                    // "120 days after"
              /\((\d+)\)\s*days?\s*after/i,               // "(120) days after"
              /one hundred twenty\s*\((\d+)\)/i,          // "one hundred twenty (120)"
              /ninety\s*\((\d+)\)/i,                      // "ninety (90)"
              /sixty\s*\((\d+)\)/i,                       // "sixty (60)"
              /thirty\s*\((\d+)\)/i,                      // "thirty (30)"
              /\((\d+)\)/,                                // Any number in parentheses
            ];
            
            // Try each pattern to extract the number of days
            for (const pattern of dayPatterns) {
              const match = dateString.match(pattern);
              if (match) {
                const foundNumber = parseInt(match[1]);
                if (foundNumber >= 1 && foundNumber <= 3650) {
                  daysToAdd = foundNumber;
                  this.logger.debug(`Found number ${foundNumber} using pattern matching`);
                  break;
                }
              }
            }
          }
          
          // If still no number found, try written numbers without parentheses
          if (!daysToAdd) {
            const writtenNumbers: Record<string, number> = {
              'thirty': 30,
              'sixty': 60,
              'ninety': 90,
              'one hundred': 100,
              'one hundred twenty': 120,
              'two hundred': 200,
            };
            
            for (const [written, number] of Object.entries(writtenNumbers)) {
              if (dateString.toLowerCase().includes(written)) {
                daysToAdd = number;
                this.logger.debug(`Found written number "${written}" -> ${number} days`);
                break;
              }
            }
          }
          
          // If we found a day count, calculate future date from today
          if (daysToAdd && !isNaN(daysToAdd)) {
            date = new Date();
            date.setDate(date.getDate() + daysToAdd);
            this.logger.debug(`Parsed "${dateString}" as ${daysToAdd} days from today -> ${date.toISOString()}`);
          } else {
            this.logger.warn(`Could not parse date or day count from: ${dateString}`);
            return dateString; // Return original if can't parse
          }
        }
        
        // Convert to YY/MM/DD format
        const year = date.getFullYear().toString().slice(-2); // Last 2 digits of year
        const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Month with leading zero
        const day = date.getDate().toString().padStart(2, '0'); // Day with leading zero
        
        return `${year}/${month}/${day}`;
      } catch (error) {
        this.logger.warn(`Error converting date ${dateString}:`, error);
        return dateString; // Return original if error
      }
    };

    // Initialize both negotiation objects if they don't exist
    if (!lead.current_negotiation) lead.current_negotiation = {} as any;
    if (!lead.budget_negotiation) lead.budget_negotiation = {} as any;

    // Extract and update BOTH current_negotiation AND budget_negotiation fields from LOI
    const updatePayload: any = {};
    let hasUpdates = false;

    // Safe numeric extractor: handles "$38.00 per sq ft", "38", 38, "10% 12.5%" (takes first number)
    const toNumber = (val: any): number | null => {
      if (val === null || val === undefined || val === '') return null;
      if (typeof val === 'number') return isNaN(val) ? null : val;
      const m = String(val).match(/([\d,]+\.?\d*)/);
      if (!m) return null;
      const n = parseFloat(m[1].replace(',', ''));
      return isNaN(n) ? null : n;
    };

    // Extract negotiation fields with EXACT Document AI field names
    // Document AI returns: rent_psf, annual_increase, tenant_improvement_psf, rent_commencement_date, free_rent_months, term
    // base_rent may come as "$38.00 per square foot" - extract the numeric dollar value
    const rawBaseRent = getValue(data.base_rent);
    const parsedBaseRent = rawBaseRent
      ? (() => {
          const m = rawBaseRent.match(/\$?([\d,]+\.?\d*)/);
          return m ? m[1].replace(',', '') : null;
        })()
      : null;
    
    // Priority order: base_rent (primary) > rent_psf > rent_per_sf > base_rent_per_sf
    const rentPerSf = parsedBaseRent || getValue(data.rent_psf) || getValue(data.rent_per_sf) || getValue(data.base_rent_per_sf);
    
    // annual_increase may return multiple values like "10% 12.5%" - take the first number only
    const annInc = getAnnIncValue(data.annual_increase) || getAnnIncValue(data.ann_inc) || getAnnIncValue(data.rent_increase);
    const freeMonths = getValue(data.free_rent_months) || getValue(data.free_months);
    const term = getValue(data.term) || getValue(data.lease_term);
    // Use special TI helper with lower confidence threshold
    const tiPerSf = getTIValue(data.tenant_improvement_psf) || getTIValue(data.ti_per_sf) || getTIValue(data.tenant_improvement_per_sf);
    // Use special RCD helper with lower confidence threshold
    const rcd = getRCDValue(data.rent_commencement_date) || getRCDValue(data.rcd);

    // Update current_negotiation and budget_negotiation fields
    if (rentPerSf !== null) {
      const numericRentPerSf = toNumber(rentPerSf);
      if (numericRentPerSf === null) {
        this.logger.warn(`rentPerSf could not be parsed to a number: "${rentPerSf}" — skipping`);
      } else {
        lead.current_negotiation.rentPerSf = numericRentPerSf;
        hasUpdates = true;
        this.logger.debug(`Extracted rentPerSf from ${rawBaseRent ? 'base_rent' : 'rent_psf'}: ${rentPerSf} -> ${numericRentPerSf}`);
      }
    }

    if (annInc !== null) {
      const numericAnnInc = toNumber(annInc);
      if (numericAnnInc !== null) {
        lead.current_negotiation.annInc = numericAnnInc;
        hasUpdates = true;
        this.logger.debug(`Extracted annInc: ${annInc} -> ${numericAnnInc}`);
      } else {
        this.logger.warn(`annInc could not be parsed to a number: "${annInc}" — skipping`);
      }
    }

    if (freeMonths !== null) {
      const numericFreeMonths = toNumber(freeMonths);
      if (numericFreeMonths !== null) {
        lead.current_negotiation.freeMonths = numericFreeMonths;
        hasUpdates = true;
        this.logger.debug(`Extracted freeMonths: ${freeMonths} -> ${numericFreeMonths}`);
      }
    }

    if (term !== null) {
      lead.current_negotiation.term = term;
      lead.budget_negotiation.term = term;
      hasUpdates = true;
      this.logger.debug(`Extracted term: ${term} (updated both objects)`);
    }

    if (tiPerSf !== null) {
      const numericTiPerSf = toNumber(tiPerSf);
      if (numericTiPerSf !== null) {
        lead.current_negotiation.tiPerSf = numericTiPerSf.toString();
        hasUpdates = true;
        this.logger.debug(`Extracted tiPerSf: ${tiPerSf} -> ${numericTiPerSf}`);
      } else {
        this.logger.warn(`tiPerSf could not be parsed to a number: "${tiPerSf}" — skipping`);
      }
    }

    if (rcd !== null) {
      // Convert date to YY/MM/DD format
      const formattedRcd = convertDateToYYMMDD(rcd);
      lead.current_negotiation.rcd = formattedRcd;
      lead.budget_negotiation.rcd = formattedRcd;
      hasUpdates = true;
      this.logger.debug(`Extracted rcd: ${rcd} -> ${formattedRcd} (updated both objects) [confidence: ${data.rent_commencement_date?.confidence?.toFixed(2)}]`);
    } else {
      this.logger.debug(`rcd not extracted - confidence too low: ${data.rent_commencement_date?.confidence?.toFixed(2)} (threshold: 0.6)`);
    }

    // Include both negotiation objects in update if we have changes
    if (hasUpdates) {
      updatePayload.current_negotiation = lead.current_negotiation;
      updatePayload.budget_negotiation = lead.budget_negotiation;
    }

    // Map general fields from LOI extraction (sf, use, property_name, tenant_name)
    if (!lead.general) lead.general = {} as any;
    let generalUpdated = false;

    const sf = getValue(data.sf) || getValue(data.square_footage);
    if (sf && !lead.general.sf) {
      lead.general.sf = sf;
      generalUpdated = true;
      this.logger.debug(`Extracted sf: ${sf}`);
    }

    const use = getValue(data.use) || getValue(data.permitted_use);
    if (use && !lead.general.use) {
      lead.general.use = use;
      generalUpdated = true;
      this.logger.debug(`Extracted use: ${use}`);
    }

    const suite = getValue(data.suite) || getValue(data.suite_number) || getValue(data.suite_id);
    if (suite && !lead.general.suite) {
      lead.general.suite = suite;
      generalUpdated = true;
      this.logger.debug(`Extracted suite: ${suite}`);
    }

    // Normalize tenant_name / tenantName — prefer the longer/more complete value
    // Also overwrite placeholder values set by frontend ("File", "Upload")
    const PLACEHOLDER_NAMES = ['file', 'upload', ''];
    const tenantA = getValue(data.tenantName);
    const tenantB = getValue(data.tenant_name);
    const resolvedTenant = tenantA || tenantB;
    const isPlaceholderBusiness = PLACEHOLDER_NAMES.includes((lead.general.businessName || '').toLowerCase());
    if (resolvedTenant && (isPlaceholderBusiness || !lead.general.businessName)) {
      lead.general.businessName = resolvedTenant;
      generalUpdated = true;
      this.logger.debug(`Extracted businessName: ${resolvedTenant}`);
    }

    // Split tenantName into firstName/lastName - always update if tenant name is extracted
    const isPlaceholderFirst = PLACEHOLDER_NAMES.includes((lead.general.firstName || '').toLowerCase());
    const isPlaceholderLast = PLACEHOLDER_NAMES.includes((lead.general.lastName || '').toLowerCase());
    if (resolvedTenant && (isPlaceholderFirst || isPlaceholderLast || !lead.general.firstName || !lead.general.lastName)) {
      const parts = resolvedTenant.trim().split(/\s+/);
      if (!lead.general.firstName || isPlaceholderFirst) { 
        lead.general.firstName = parts[0] || ''; 
        generalUpdated = true; 
      }
      if (!lead.general.lastName || isPlaceholderLast) { 
        lead.general.lastName = parts.slice(1).join(' ') || ''; 
        generalUpdated = true; 
      }
      this.logger.debug(`Split tenantName "${resolvedTenant}" into firstName: "${lead.general.firstName}", lastName: "${lead.general.lastName}"`);
    }

    // Extract email from LOI document
    const email = getValue(data.email) || getValue(data.tenant_email) || getValue(data.contact_email);
    if (email && (!lead.general.email || PLACEHOLDER_NAMES.includes((lead.general.email || '').toLowerCase()))) {
      lead.general.email = email;
      generalUpdated = true;
      this.logger.debug(`Extracted email: ${email}`);
    }

    // Lookup property by extracted property_name, save name in general and propertyId at root
    const extractedPropertyName = getValue(data.property_name);
    if (extractedPropertyName) {
      this.logger.debug(`Looking up property by name: "${extractedPropertyName}"`);
      try {
        const matchedProperty = await this.propertiesService.findByNameFuzzy(extractedPropertyName);
        if (matchedProperty) {
          lead.general.property = matchedProperty.propertyName;
          generalUpdated = true;
          updatePayload.propertyId = matchedProperty.propertyId;
          this.logger.log(`Matched property: "${matchedProperty.propertyName}" (${matchedProperty.propertyId})`);
        } else {
          // No match — still save the raw extracted name so it's not lost
          lead.general.property = extractedPropertyName;
          generalUpdated = true;
          this.logger.warn(`No property matched for: "${extractedPropertyName}" — saved raw name only`);
        }
      } catch (err) {
        this.logger.warn(`Property lookup failed for "${extractedPropertyName}": ${err.message}`);
      }
    }

    if (generalUpdated) {
      updatePayload.general = lead.general;
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
    this.logger.log(`Updated both current_negotiation and budget_negotiation with extracted values`);
  }

  // ==================== Unified Document Upload (3-Day, Courtesy, Attorney, etc.) ====================

  /**
   * Get presigned S3 upload URL for any document type
   * Supports both Leads and Renewals
   * @param id - Lead or Renewal ID
   * @param documentType - Type of document (3-day-notice, courtesy-notice, attorney-notice, loi, etc.)
   * @param recordType - Type of record (LEAD, RENEWAL, LEASE)
   */
  async getDocumentUploadUrl(
    id: string,
    documentType: string,
    recordType: string = 'LEAD',
    contentType: string = 'application/pdf',
  ) {
    // Validate record exists
    await this.validateAndFetchRecord(id, recordType);

    const ALLOWED = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg', 'image/png', 'image/tiff', 'image/webp',
    ];
    if (!ALLOWED.includes(contentType)) contentType = 'application/pdf';

    // Determine folder path based on record type
    const basePath = recordType === 'RENEWAL' ? 'renewals' : 'leads';
    const folderPath = `${basePath}/${id}/documents/${documentType}`;

    const { key, url } = await this.mediaService.generateUploadUrl(folderPath, contentType);

    this.logger.log(`Generated upload URL for ${recordType} ${id}, document type: ${documentType}`);

    return {
      statusCode: 200,
      message: 'Document upload URL generated successfully',
      data: {
        key,
        url,
        contentType,
        documentType,
        recordType,
      },
    };
  }

  /**
   * Confirm document upload and save metadata
   * Supports both Leads and Renewals
   * @param id - Lead or Renewal ID
   * @param key - S3 key from upload
   * @param fileName - Original filename
   * @param fileSize - File size in bytes
   * @param documentType - Type of document
   * @param recordType - Type of record (LEAD, RENEWAL, LEASE)
   * @param userName - User who uploaded
   */
  async confirmDocumentUploadUnified(
    id: string,
    key: string,
    fileName: string,
    fileSize: number,
    documentType: string,
    recordType: string = 'LEAD',
    userName: string = 'System',
    mimeType: string = 'application/pdf',
  ) {
    // Validate record exists
    const record = await this.validateAndFetchRecord(id, recordType);

    this.logger.log(`Confirming ${documentType} upload for ${recordType} ${id}: ${key}`);

    // Create file metadata
    const fileInfo = {
      id: key,
      key: key,
      fileName,
      fileSize,
      fileType: mimeType,
      category: documentType,
      uploadedBy: userName,
      uploadedDate: new Date(),
      updatedBy: userName,
      updatedAt: new Date(),
    };

    // Save to appropriate record type
    if (recordType === 'RENEWAL') {
      // Update renewal with file
      const files = record.files || [];
      files.push(fileInfo as any);
      await this.renewalrepo.updateRenewal(id, { files });
      this.logger.log(`Saved ${documentType} to renewal ${id}`);
    } else {
      // Update lead with file
      const files = record.files || [];
      files.push(fileInfo as any);
      await this.repo.update(id, { files });
      this.logger.log(`Saved ${documentType} to lead ${id}`);

      // Special handling for LOI documents - trigger Document AI processing
      if (documentType === 'loi' && recordType === 'LEAD') {
        this.logger.log(`Triggering Document AI processing for LOI document: ${key}`);
        
        const detectedMime = this.getMimeTypeFromKey(key);
        if (!detectedMime) {
          this.logger.warn(`Unsupported file format for Document AI: ${key} — skipping AI processing`);
        } else {
          // Update lead with LOI document URL (for compatibility)
          await this.repo.update(id, { loiDocumentUrl: key });
          
          // Queue for Document AI processing
          await this.leadsQueue.add(JOBNAME.PROCESS_DOCUMENT, {
            leadId: id,
            fileId: key,
            fileKey: key,
            mimeType: detectedMime,
            documentType: 'loi',
          });

          this.logger.log(`LOI document queued for Document AI processing: ${key} (mimeType: ${detectedMime})`);
        }
      }
    }

    return {
      statusCode: 200,
      message: `${documentType} document uploaded successfully`,
      data: {
        ...fileInfo,
        recordType,
        uploadedAt: fileInfo.uploadedDate.toISOString(),
      },
    };
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
    
    // updatePayload.lead_status=LeadStatus.DRAFTING_LEASE
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

    // Handle lead_status if provided
    if (formData.lead_status) {
      updatePayload.lead_status = formData.lead_status;
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
          lead_status: 'DRAFTING_LEASE',
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
          lead_status: { $nin: ['LEASE_NEGOTIATION','RENEWAL_NEGOTIATION', 'Renewal Negotiation'] },
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
          lead_status: { $in: ['LOI_NEGOTIATION', 'QUALIFYING', 'OUT_FOR_EXECUTION','DRAFTING_LEASE',''] },
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
          lead_status: 'SEND_ATTORNEY_NOTICE',
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

  async updateDealTerms(id: string, rounds: any[]) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Lead not found');
    }

    const lead = await this.repo.findById(id);
    if (!lead) throw new NotFoundException('Lead not found');

    const emptyValues = () => ({
      term: '', baseRent: 0, annualIncrease: '', rcd: '', nnn: 0,
      camCap: '', camCapDetails: '', insReimbursement: '', insReimbursementDetails: '',
      retReimbursement: '', retReimbursementDetails: '', securityDeposit: '',
      securityDepositDetails: '', prepaidRent: '', use: '', exclusiveUse: '',
      option: '', optionDetails: '', guaranty: '', guarantyDetails: '',
      tiAllowance: '', tiAllowanceDetails: '', percentageRent: '',
      percentageRentDetails: '', deliveryOfSpace: '',
    });

    const existingRounds: any[] = (lead as any).dealTerms?.rounds || [];

    // Strip fields that are empty string or 0 (treat as "not provided")
    const stripEmpty = (obj: Record<string, any>) =>
      Object.fromEntries(
        Object.entries(obj).filter(([, v]) => v !== '' && v !== 0 && v != null),
      );

    const normalizedRounds = rounds.map((round, index) => {
      const existingRound = existingRounds.find(r => r.id === round.id) || existingRounds[index] || {};
      const existingInitial = existingRound.initial || {};
      const existingCounter = existingRound.counter || {};

      return {
        id: round.id || `round-${index + 1}`,
        label: round.label || `Round ${index + 1}`,
        initial: { ...emptyValues(), ...existingInitial, ...stripEmpty(round.initial || {}) },
        counter: { ...emptyValues(), ...existingCounter, ...stripEmpty(round.counter || {}) },
      };
    });

    const updated = await this.repo.update(id, { dealTerms: { rounds: normalizedRounds } } as any);
    return updated;
  }
}

