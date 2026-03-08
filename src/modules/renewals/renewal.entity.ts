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
    enum: ['Renewal Negotiation', 'Drafting Amendment', 'No Contact', 'Renewed', 'Out for Execution', 'Expired'],
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

  @Prop({ type: Object, required: false })
  mriData?: Record<string, any>; // Store raw MRI data for debugging
}

export const RenewalSchema = SchemaFactory.createForClass(Renewal);

// Compound indexes for common queries
RenewalSchema.index({ propertyId: 1, leaseEnd: 1 });
RenewalSchema.index({ status: 1, leaseEnd: 1 });
RenewalSchema.index({ lastSyncAt: 1 });