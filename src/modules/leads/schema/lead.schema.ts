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
    default: LeadStatus.PROSPECT,
    index: true,
  })
  lead_status: LeadStatus;

  @Prop({ type: GeneralDetailsSchema, default: () => ({}) })
  general: GeneralDetails;

  @Prop({ type: BusinessDetailsSchema, default: () => ({}) })
  business: BusinessDetails;

  @Prop({ type: FinancialDetailsSchema, default: () => ({}) })
  financial: FinancialDetails;

  @Prop({ type: DealTermsSchema, default: () => ({}) })
  dealTerms: DealTerms;

  @Prop({ type: DraftingDetailsSchema, default: () => ({}) })
  current_negotiation: DraftingDetails;

  @Prop({ type: DraftingDetailsSchema, default: () => ({}) })
  budget_negotiation: DraftingDetails;

  @Prop({ type: [ReferenceInfoSchema], default: [] })
  references: ReferenceInfo[];

  @Prop({ type: AccountingDetailsSchema, default: () => ({}) })
  accounting: AccountingDetails;

  @Prop({ type: BrokerInfoSchema, default: () => ({}) })
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
    index: true,
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