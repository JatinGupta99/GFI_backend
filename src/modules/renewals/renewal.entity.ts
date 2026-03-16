import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { RenewalStatus } from '../../common/enums/common-enums';

@Schema({ _id: false })
export class BudgetNegotiation {

  @Prop({ type: Number, default: 0 })
  tiPerSf?: number;

  @Prop({ type: String, default: '' })
  rcd?: string;

  @Prop({ type: Number, default: 0 })
  rentPerSf?: number;

  @Prop({type:Boolean,default:false})
  budgetRenew:boolean;
}

export const BudgetNegotiationSchema = SchemaFactory.createForClass(BudgetNegotiation);

@Schema({ _id: false })
export class RentEscalations {
  @Prop({type:Number,default:0})
  year1?: number=0;
  
  @Prop({type:Number,default:0})
  year2?: number=0;
  
  @Prop({type:Number,default:0})
  year3?: number=0;
  
  @Prop({type:Number,default:0})
  year4?: number=0;
}
export type RenewalDocument = Renewal & Document;
@Schema({ timestamps: true })
export class Renewal {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  propertyId: string;

  @Prop({ required: false,default:''  })
  address: string;

  @Prop({ required: true })
  propertyName: string;

  @Prop({ required: true })
  tenantName: string;

  @Prop({ required: true })
  suite: string;

  @Prop({ required: true })
  sf: number;

  @Prop({ required: true, index: true })
  leaseEnd: Date;

  @Prop({ required: false })
  renewalOffer?: string;

  @Prop({ required: true })
  currentMonthRent: number;

  @Prop({ required: false, default: 0 })
  currentRentPerSf?: number;

  @Prop({ 
    type: BudgetNegotiationSchema, 
    default: () => ({
      tiPerSf: 0,
      rentPerSf: 0,
      rcd: '',
      budgetRenew: false,
    })
  })
  budget_negotiation: BudgetNegotiation;

  @Prop({
    required: true,
    enum: Object.values(RenewalStatus),
    index: true
  })
  status: RenewalStatus;

  @Prop({ required: false })
  notes?: string;

  @Prop({ required: false })
  option: 'Yes' | 'No' | 'N/A';

  @Prop({ required: false })
  optionTerm?: string;

  @Prop({ required: true })
  lastSyncAt: Date;

  @Prop({ required: true })
  mriLeaseId: string;

  // MRI Report API Data
  @Prop({ required: false })
  monthlyRent?: number;

  @Prop({ required: false })
  cam?: number;

  @Prop({ required: false })
  ins?: number;

  @Prop({ required: false })
  tax?: number;

  @Prop({ required: false })
  totalDueMonthly?: number;

  @Prop({ required: false })
  balanceForward?: number;

  @Prop({ required: false })
  cashReceived?: number;

  @Prop({ required: false })
  balanceDue?: number;

  @Prop()
  days0To30?: number;

  @Prop()
  days31To60?: number;

  @Prop()
  days61Plus?: number;

  @Prop()
  totalArBalance?: number;

  @Prop({ type: RentEscalations })
  rentEscalations?: RentEscalations;

  @Prop({ type: Object, required: false })
  mriData?: Record<string, any>; // Store raw MRI data for debugging

  @Prop({ type: Array, required: false, default: [] })
  files?: Array<{
    id: string;
    key: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    category: string;
    uploadedBy: string;
    uploadedDate: Date;
    updatedBy: string;
    updatedAt: Date;
  }>;
}

export const RenewalSchema = SchemaFactory.createForClass(Renewal);

// Compound indexes for common queries
RenewalSchema.index({ propertyId: 1, leaseEnd: 1 });
RenewalSchema.index({ status: 1, leaseEnd: 1 });
RenewalSchema.index({ lastSyncAt: 1 });