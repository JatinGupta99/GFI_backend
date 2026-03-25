import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
@Schema({ _id: false })
export class LeaseInfo {

  @Prop({ type: String, trim: true })
  submittedBy?: string;

  @Prop({ type: String, trim: true })
  submittedTo?: string;

  @Prop({ type: Date })
  submittedDate?: Date;

  @Prop({ type: Date })
  approvedDate?: Date;

  @Prop({ type: Date })
  dateSubmitted?: Date;

  @Prop({ type: Date })
  dateApproved?: Date;

  @Prop({ type: Number })
  daysWaiting?: number;

  @Prop({ type: Number })
  daysToApprove?: number;

  @Prop({ type: Boolean, default: null })
  approved?: boolean | null;
}
export const LeaseInfoSchema = SchemaFactory.createForClass(LeaseInfo);
