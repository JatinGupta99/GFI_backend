import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema()
export class LeadSuite {
  @Prop({ type: Types.ObjectId, ref: 'Lead', required: true })
  leadId: string;

  @Prop({ type: Types.ObjectId, ref: 'Suite', required: true })
  suiteId: string;

  @Prop({ default: true })
  qualifies: boolean;
}

export type LeadSuiteDocument = LeadSuite & Document;
export const LeadSuiteSchema = SchemaFactory.createForClass(LeadSuite);
