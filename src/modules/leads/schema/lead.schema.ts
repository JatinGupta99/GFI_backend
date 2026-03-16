import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { FormStatus, LeadStatus } from '../../../common/enums/common-enums';
import { AccountingDetails, AccountingDetailsSchema } from './sub-schemas/accounting.schema';
import { BrokerInfo, BrokerInfoSchema } from './sub-schemas/broker.schema';
import { BusinessDetails, BusinessDetailsSchema } from './sub-schemas/business.schema';
import { DealTerms, DealTermsSchema } from './sub-schemas/deal-terms.schema';
import { DraftingDetails, DraftingDetailsSchema } from './sub-schemas/drafting.schema';
import { FileInfo, FileInfoSchema } from './sub-schemas/file.schema';
import { FinancialDetails, FinancialDetailsSchema } from './sub-schemas/financial.schema';
import { GeneralDetails, GeneralDetailsSchema } from './sub-schemas/general.schema';
import { ReferenceInfo, ReferenceInfoSchema } from './sub-schemas/reference.schema';
import { LeaseInfo, LeaseInfoSchema } from './sub-schemas/lease-info.schema';
export enum LeaseStatus {
  LEASE_NEGOTIATION = 'LEASE_NEGOTIATION',
  OUT_FOR_EXECUTION = 'OUT_FOR_EXECUTION',
  DRAFTING_LEASE = 'DRAFTING_LEASE',
}

export enum ApprovalStatus {
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  PENDING = 'PENDING',
}

export enum SignatureStatus {
  DRAFT = 'DRAFT',
  PENDING_SIGNATURE = 'PENDING_SIGNATURE',
  SIGNED = 'SIGNED',
  VOIDED = 'VOIDED',
}
@Schema({ timestamps: true })
@Schema({ timestamps: true })
export class Lead {

  @Prop({
    type: String,
    enum: Object.values(LeadStatus),
    default: LeadStatus.QUALIFYING,
    index: true,
  })
  lead_status: string;

  @Prop({ type: String })
  propertyId: string;

  @Prop({ 
    type: GeneralDetailsSchema, 
    default: () => ({
      firstName: '',
      lastName: '',
      email: '',
      cellPhone: '',
      workPhone: '',
      dob: '',
      jobTitle: '',
      ssn: '',
      spouseName: '',
      spouseDob: '',
      businessName: '',
      spouseSsn: '',
      mailingAddress: '',
      residentialAddress: '',
      howLongAtAddress: '',
      presentEmployer: '',
      businessExperienceSummary: '',
      hasCoApplicant: false,
      driversLicenseUploaded: false,
      suite: '',
      use: '',
      sf: '',
      notes: '',
      applicationSubmitted: false,
    })
  })
  general: GeneralDetails;

  @Prop({ 
    type: BusinessDetailsSchema, 
    default: () => ({
      legalName: '',
      fein: '',
      stateOfIncorporation: '',
      tradeName: '',
      currentBusinessAddress: '',
      proposedBusinessDescription: '',
      businessTelephone: '',
      isRelocating: '',
      howLongInBusiness: '',
      howManyLocations: '',
      typeOfEntity: '',
    })
  })
  business: BusinessDetails;

  @Prop({ 
    type: FinancialDetailsSchema, 
    default: () => ({
      assets: {
        checkingSavings: false,
        stocksBonds: false,
        retirementAccounts: false,
        automobiles: '',
        realEstateResidence: '',
        realEstateInvestment: '',
        otherAssets: '',
      },
      liabilities: {
        creditCardBalances: '',
        taxesPayable: '',
        mortgagesDue: '',
        otherLiabilities: '',
      },
      annualIncome: '',
      monthlyMortgageRent: '',
      guarantor: '',
      guarantorSsn: '',
      totalAssets: '',
      liquidAssets: '',
      creditScore: '',
      netWorth: '',
      totalLiabilities: '',
      assetsCheckingAcct: '',
      assetsSavingsAcct: '',
      assetsRealEstate: '',
      assetsStocksBonds: '',
    })
  })
  financial: FinancialDetails;

  @Prop({ 
    type: DealTermsSchema, 
    default: () => ({
      rounds: [],
    })
  })
  dealTerms: DealTerms;

  @Prop({ 
    type: DraftingDetailsSchema, 
    default: () => ({
      rentPerSf: 0,
      annInc: 0,
      freeMonths: 0,
      term: 0,
      tiPerSf: 0,
      rcd: '',
    })
  })
  current_negotiation: DraftingDetails;

  @Prop({ 
    type: DraftingDetailsSchema, 
    default: () => ({
      rentPerSf: 0,
      annInc: 3,
      freeMonths: 0,
      term: 0,
      tiPerSf: 0,
      rcd: '',
    }),
    set: function(value: any) {
      // Ensure defaults are applied even when data is provided
      if (value && typeof value === 'object') {
        return {
          rentPerSf: value.rentPerSf ?? 0,
          annInc: value.annInc ?? 3,  // Default to 3 if not provided
          freeMonths: value.freeMonths ?? 0,  // Default to 0 if not provided
          term: value.term ?? 0,
          tiPerSf: value.tiPerSf ?? 0,
          rcd: value.rcd ?? '',
        };
      }
      return value;
    }
  })
  budget_negotiation: DraftingDetails;
  
  @Prop({ 
    type: DraftingDetailsSchema, 
    default: () => ({
      rentPerSf: 0,
      annInc: 0,
      freeMonths: 0,
      term: '',
      tiPerSf: 0,
      rcd: '',
    })
  })
  approved_terms: DraftingDetails;

  @Prop({ type: [ReferenceInfoSchema], default: [] })
  references: ReferenceInfo[];

  @Prop({ 
    type: AccountingDetailsSchema, 
    default: () => ({
      baseRent: 0,
      cam: 0,
      lateFee: 0,
      ins: 0,
      tax: 0,
      totalDue: 0,
      balanceDue: 0,
      rentDueDate: '',
      lateAfter: '',
      balance_forward_0131: 0,
      feb_cash_received: 0,
      annualPMT: {
        janPmt: 0,
        febPmt: 0,
        marPmt: 0,
        aprPmt: 0,
        mayPmt: 0,
        junPmt: 0,
        julPmt: 0,
        augPmt: 0,
        septPmt: 0,
        octPmt: 0,
        novPmt: 0,
        decPmt: 0,
      },
    })
  })
  accounting: AccountingDetails;

  @Prop({ 
    type: BrokerInfoSchema, 
    default: () => ({
      brokerParticipation: '',
      companyName: '',
      companyAddress: '',
      companyPhone: '',
      contactName: '',
      email: '',
      phone: '',
      commissionStructure: '',
      commissionAmount: 0,
    })
  })
  broker: BrokerInfo;

  @Prop({ type: [FileInfoSchema], default: [] })
  files: FileInfo[];

  @Prop({ type: String, trim: true })
  createdBy: string;

  @Prop({ type: String, trim: true })
  lastModifiedBy?: string;

  @Prop({
    type: String,
    enum: Object.values(FormStatus),
    default: FormStatus.CREATED,
  })
  form_status?: FormStatus;

  @Prop({ type: String, trim: true })
  lead_notes?: string;

  @Prop({ type: String, trim: true })
  lease_notes?: string;

  @Prop({ type: String })
  docusignEnvelopeId?: string;

  @Prop({
    type: String,
    enum: Object.values(SignatureStatus),
    default: SignatureStatus.DRAFT,
  })
  signatureStatus?: SignatureStatus;

  @Prop({ type: String })
  signedDocumentUrl?: string;

  @Prop({ type: Date })
  sentForSignatureAt?: Date;

  @Prop({ type: Date })
  signedAt?: Date;

  @Prop({ type: String })
  pdfDocumentUrl?: string;

  @Prop({ type: String })
  loiDocumentUrl?: string; // S3 key for LOI document

  @Prop({ type: LeaseInfoSchema })
  lease?: LeaseInfo;

    @Prop({
      type: String,
      index: true,
    })
    lease_status?: string;
    
    @Prop({
      type: String,
      index: true,
    })
    approval_status?: string;
}


export type LeadDocument = Lead & Document;
export const LeadSchema = SchemaFactory.createForClass(Lead);
LeadSchema.index({ status: 1 });
LeadSchema.index({ 'lease.lease_status': 1 });
LeadSchema.index({ 'lease.approval_status': 1 });
LeadSchema.index({ signatureStatus: 1 });
LeadSchema.index({ createdAt: -1 });
LeadSchema.index({ 'general.property': 1 });
LeadSchema.index({ propertyId: 1 });