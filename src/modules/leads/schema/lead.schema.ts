import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { FormStatus, LeadStatus } from '../../../common/enums/common-enums';
import { AccountingDetails, AccountingDetailsSchema } from './sub-schemas/accounting.schema';
import { ActivityLog, ActivityLogSchema } from './sub-schemas/activity.schema';
import { BrokerInfo, BrokerInfoSchema } from './sub-schemas/broker.schema';
import { BusinessDetails, BusinessDetailsSchema } from './sub-schemas/business.schema';
import { DealTerms, DealTermsSchema } from './sub-schemas/deal-terms.schema';
import { DraftingDetails, DraftingDetailsSchema } from './sub-schemas/drafting.schema';
import { FileInfo, FileInfoSchema } from './sub-schemas/file.schema';
import { FinancialDetails, FinancialDetailsSchema } from './sub-schemas/financial.schema';
import { GeneralDetails, GeneralDetailsSchema } from './sub-schemas/general.schema';
import { ReferenceInfo, ReferenceInfoSchema } from './sub-schemas/reference.schema';
import { Activity, ActivitySchema } from '../../property-assets/schemas/activity.schema';

@Schema({ timestamps: true })
export class Lead {

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
  current_negotiation: DraftingDetails;

  @Prop({ type: DraftingDetailsSchema, default: () => ({}) })
  budget_negotiation: DraftingDetails;

  @Prop({ type: ReferenceInfoSchema, default: () => ({}) })
  references: ReferenceInfo;

  @Prop({ type: AccountingDetailsSchema, default: () => ({}) })
  accounting: AccountingDetails;

  @Prop({ type: BrokerInfoSchema, default: () => ({}) })
  broker: BrokerInfo;

  @Prop({ type: [FileInfoSchema], default: [] })
  files: FileInfo[];

  @Prop({ default: '' })
  createdBy: string;

  @Prop({ default: '' })
  lastModifiedBy: string;

  @Prop({
    type: String,
    enum: Object.values(FormStatus),
    default: FormStatus.CREATED,
  })
  form_status?: FormStatus;

  @Prop({type:Boolean})
  isLease?:boolean=false;

  @Prop({type:String})
  lead_notes?:string='Note';
  
  @Prop({type:String})
  lease_notes?:string='Note';
}

export type LeadDocument = Lead & Document;
export const LeadSchema = SchemaFactory.createForClass(Lead);
