import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { LeadStatus } from '../../../common/enums/common-enums';
import { GeneralDetailsSchema, GeneralDetails } from './sub-schemas/general.schema';
import { BusinessDetailsSchema, BusinessDetails } from './sub-schemas/business.schema';
import { FinancialDetailsSchema, FinancialDetails } from './sub-schemas/financial.schema';
import { DealTermsSchema, DealTerms } from './sub-schemas/deal-terms.schema';
import { FileInfoSchema, FileInfo } from './sub-schemas/file.schema';
import { ActivityLogSchema, ActivityLog } from './sub-schemas/activity.schema';
import { ReferenceInfoSchema, ReferenceInfo } from './sub-schemas/reference.schema';
import { DraftingDetailsSchema, DraftingDetails } from './sub-schemas/drafting.schema';
import { AccountingDetailsSchema, AccountingDetails } from './sub-schemas/accounting.schema';
import { BrokerInfoSchema, BrokerInfo } from './sub-schemas/broker.schema';

@Schema({ timestamps: true })
export class Lead {
  @Prop({ default: '' })
  prospect: string;

  @Prop({ default: '' })
  property: string;

  @Prop({ default: '' })
  suite: string;

  @Prop({ default: 0 })
  sf: number;

  @Prop({ default: '' })
  use: string;

  @Prop({
    type: String,
    enum: Object.values(LeadStatus),
    default: LeadStatus.PROSPECT,
    index: true,
  })
  status: LeadStatus;

  @Prop({ type: GeneralDetailsSchema, default: () => ({}) })
  general: GeneralDetails;

  @Prop({ type: BusinessDetailsSchema, default: () => ({}) })
  business: BusinessDetails;

  @Prop({ type: FinancialDetailsSchema, default: () => ({}) })
  financial: FinancialDetails;

  @Prop({ type: DealTermsSchema, default: () => ({}) })
  dealTerms: DealTerms;

  @Prop({ type: DraftingDetailsSchema, default: () => ({}) })
  drafting: DraftingDetails;

  @Prop({ type: [ReferenceInfoSchema], default: [] })
  references: ReferenceInfo[];

  @Prop({ type: AccountingDetailsSchema, default: () => ({}) })
  accounting: AccountingDetails;

  @Prop({ type: BrokerInfoSchema, default: () => ({}) })
  broker: BrokerInfo;

  @Prop({ type: [FileInfoSchema], default: [] })
  files: FileInfo[];

  @Prop({ type: [ActivityLogSchema], default: [] })
  activities: ActivityLog[];

  @Prop({ default: '' })
  createdBy: string;

  @Prop({ default: '' })
  lastModifiedBy: string;
}

export type LeadDocument = Lead & Document;
export const LeadSchema = SchemaFactory.createForClass(Lead);
