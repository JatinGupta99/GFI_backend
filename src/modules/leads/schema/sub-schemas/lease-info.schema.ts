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
}
export const LeaseInfoSchema = SchemaFactory.createForClass(LeaseInfo);
