import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RenewalDocument = Renewal & Document;

@Schema({ timestamps: true })
export class Renewal {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  propertyId: string;

  @Prop({ required: true })
  propertyName: string;

  @Prop({ required: true })
  tenantName: string;

  @Prop({ required: true })
  unit: string;

  @Prop({ required: true })
  sf: number;

  @Prop({ required: true, index: true })
  leaseEnd: Date;

  @Prop({ required: false })
  renewalOffer?: string;

  @Prop({ required: true })
  currentRent: number;

  @Prop({ required: true })
  rentPerSf: number;

  @Prop({ required: false })
  budgetRent?: number;

  @Prop({ required: false })
  budgetRentPerSf?: number;

  @Prop({ required: false })
  budgetTI?: number;

  @Prop({ required: false })
  budgetLCD?: string;

  @Prop({
    required: true,
    enum: ['DRAFTING_AMENDMENT', 'OUT_FOR_EXECUTION', 'DRAFTING_LEASE','DEAD','NO_CONTACT','AMENDMENT_EXECUTED'],
    index: true
  })
  status: string;

  @Prop({ required: false })
  notes?: string;

  @Prop({ required: false })
  option: 'Yes' | 'No' | 'N/A';

  @Prop({ required: false })
  optionTerm?: string;

  @Prop({ required: false })
  lcd?: string;

  @Prop({ required: true, index: true })
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

  @Prop({ required: false })
  days0To30?: string;

  @Prop({ required: false })
  days31To60?: string;

  @Prop({ required: false })
  days61Plus?: string;

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