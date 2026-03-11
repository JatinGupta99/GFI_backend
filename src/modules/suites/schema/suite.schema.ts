import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ _id: false })
export class Charges {
  @Prop({ default: 0 })
  baseRentMonth: number;

  @Prop({ default: 0 })
  camMonth: number;

  @Prop({ default: 0 })
  insMonth: number;

  @Prop({ default: 0 })
  taxMonth: number;

  @Prop({ default: 0 })
  totalDueMonth: number;
}

@Schema({ _id: false })
export class LeaseTerms {
  @Prop({ type: String, default: null })
  rentDueDate: string | null;

  @Prop({ type: String, default: null })
  lateAfter: string | null;

  @Prop({ default: 0 })
  lateFee: number;
}

@Schema({ _id: false })
export class MonthlyPayments {
  @Prop({ default: 0 })
  jan: number;

  @Prop({ default: 0 })
  feb: number;

  @Prop({ default: 0 })
  mar: number;

  @Prop({ default: 0 })
  apr: number;

  @Prop({ default: 0 })
  may: number;

  @Prop({ default: 0 })
  jun: number;

  @Prop({ default: 0 })
  jul: number;

  @Prop({ default: 0 })
  aug: number;

  @Prop({ default: 0 })
  sept: number;

  @Prop({ default: 0 })
  oct: number;

  @Prop({ default: 0 })
  nov: number;

  @Prop({ default: 0 })
  dec: number;
}

@Schema({ timestamps: true })
export class Suite {
  @Prop({ required: true })
  suiteId: string;

  @Prop()
  squareFootage: number;

  @Prop({
    enum: ['Vacant', 'Occupied', 'ComingSoon'],
    default: 'Vacant',
  })
  status: string;

  @Prop()
  budgetBaseRent: number;

  @Prop()
  budgetTI: number;

  @Prop()
  budgetRCD: Date;

  // New calculated fields from budget parsing
  @Prop({ type: String, default: '0' })
  tiPerSf: string;

  @Prop({ type: String, default: '0' })
  baseRentPerSf: string;

  @Prop({ type: String, default: '0' })
  camPerSf: string;

  @Prop({ type: String, default: '0' })
  insPerSf: string;

  @Prop({ type: String, default: '0' })
  taxPerSf: string;

  @Prop({ type: String, required: true, index: true })
  propertyId: string;

  // ForeSight financial data
  @Prop({ type: Charges })
  charges: Charges;

  @Prop({ default: 0 })
  balanceDue: number;

  @Prop({ type: LeaseTerms })
  leaseTerms: LeaseTerms;

  @Prop({ type: MonthlyPayments })
  monthlyPayments: MonthlyPayments;
}

export type SuiteDocument = Suite & Document;
export const SuiteSchema = SchemaFactory.createForClass(Suite);

// Create compound index for propertyId and suiteId
SuiteSchema.index({ propertyId: 1, suiteId: 1 }, { unique: true });
