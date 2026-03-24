import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Renewal {
  @Prop({ type: String, required: true, index: true })
  id: string; // LeaseID from MRI

  @Prop({ type: String, required: true })
  tenant: string; // OccupantName from MRI

  @Prop({ type: String, required: true, index: true })
  property: string; // BuildingName from MRI

  @Prop({ type: String, required: true })
  suite: string; // SuiteID from MRI

  @Prop({ type: String, required: true }) // Changed from Number to String to match API
  sf: string; // OrigSqFt from MRI (comes as string like "4155.00")

  @Prop({ type: String, required: true })
  expDate: string; // Expiration date from EMEA/Offers (ISO string format)

  @Prop({ type: String, enum: ['Yes', 'No', 'N/A'], required: true })
  option: string; // Whether lease has options

  @Prop({ type: String, required: false })
  optionTerm?: string; // Option details

  @Prop({ type: Number, required: true })
  rentPerSf: number; // Calculated rent per square foot

  @Prop({ type: String, required: true }) // Changed from Number to String to match API
  budgetSf: string; // Budget square footage (comes as string like "4155.00")

  @Prop({ type: Number, required: true })
  budgetRent: number; // Budget rent

  @Prop({ type: String, required: true })
  budgetLcd: string; // Budget LCD (comes as string like "N/A")

  @Prop({ type: String, required: true })
  status: string; // Renewal status

  @Prop({ type: String, required: false })
  note?: string; // Combined notes from MRI CommercialLeasesNote API

  // Financial fields from MRI APIs
  @Prop({ type: Number, required: false })
  monthlyRent?: number; // From CMRECC API

  @Prop({ type: Number, required: false })
  cam?: number; // From CMRECC API

  @Prop({ type: Number, required: false })
  ins?: number; // From CMRECC API

  @Prop({ type: Number, required: false })
  tax?: number; // From CMRECC API

  @Prop({ type: Number, required: false })
  totalDueMonthly?: number; // From CMRECC API

  @Prop({ type: Number, required: false })
  balanceForward?: number; // From CurrentDelinquencies API

  @Prop({ type: Number, required: false })
  cashReceived?: number; // From CurrentDelinquencies API

  @Prop({ type: Number, required: false })
  balanceDue?: number; // From CurrentDelinquencies API

  @Prop({ type: String, required: false })
  days0To30?: string; // From CurrentDelinquencies API (comes as string like "0.00")

  @Prop({ type: String, required: false })
  days31To60?: string; // From CurrentDelinquencies API (comes as string like "0.00")

  @Prop({ type: String, required: false })
  days61Plus?: string; // From CurrentDelinquencies API (comes as string like "0.00")

  // Sync metadata
  @Prop({ type: Date, required: true, default: Date.now })
  lastSyncedAt: Date; // When this record was last synced from MRI

  @Prop({ type: String, required: true })
  syncJobId: string; // Job ID that created/updated this record

  @Prop({ type: Boolean, required: true, default: true })
  isActive: boolean; // Whether this renewal is still active
}

export type RenewalDocument = Renewal & Document;
export const RenewalSchema = SchemaFactory.createForClass(Renewal);

// Create compound indexes for efficient querying
RenewalSchema.index({ property: 1, isActive: 1 });
RenewalSchema.index({ id: 1, property: 1 }, { unique: true });
RenewalSchema.index({ lastSyncedAt: -1 });
RenewalSchema.index({ syncJobId: 1 });