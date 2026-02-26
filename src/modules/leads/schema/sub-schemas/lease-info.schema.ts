import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export enum LeaseStatus {
  PENDING = 'PENDING',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  LEASE_NEGOTIATION = 'LEASE_NEGOTIATION',
  OUT_FOR_EXECUTION = 'OUT_FOR_EXECUTION',
  DRAFTING_LEASE='DRAFTING_LEASE',
  APPROVAL_ALL='APPROVAL_ALL',
  LEASE_ALL='LEASE_ALL',
}

@Schema({ _id: false })
export class LeaseInfo {
  @Prop({ type: String, default: '' })
  submittedBy?: string;

  @Prop({ type: String, default: '' })
  submittedTo?: string;

  @Prop({ type: String, default: '' })
  submittedDate?: string;

  @Prop({ type: String, default: '' })
  approvedDate?: string;

  @Prop({
    type: String,
    enum: Object.values(LeaseStatus),
    default: LeaseStatus.LEASE_ALL,
  })
  status?: LeaseStatus;
}

export const LeaseInfoSchema = SchemaFactory.createForClass(LeaseInfo);
