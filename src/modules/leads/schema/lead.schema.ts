import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { LeadStatus } from '../../../common/enums/common-enums';

@Schema({ timestamps: true })
export class Lead {
  @Prop({ required: true, trim: true })
  firstName!: string;

  @Prop({ required: true, trim: true })
  lastName!: string;

  @Prop({
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  })
  email!: string;

  @Prop({ trim: true, default: '' })
  cellPhone?: string;

  @Prop({ trim: true, default: '' })
  workPhone?: string;

  @Prop({ trim: true, default: '' })
  jobTitle?: string;

  @Prop({ trim: true, default: '' })
  spouseName?: string;

  @Prop({ trim: true, default: '' })
  businessName?: string;

  @Prop({ trim: true, default: '' })
  mailingAddress?: string;

  @Prop({ trim: true, default: '' })
  residentialAddress?: string;

  @Prop({ trim: true, default: '' })
  use?: string;

  @Prop({ trim: true, default: '' })
  property?: string;

  @Prop({ trim: true, default: '' })
  suite?: string;

  @Prop({ trim: true, default: 'Note' })
  notes?: string;

  @Prop({
    type: String,
    enum: Object.values(LeadStatus),
    default: LeadStatus.PROSPECT,
    index: true,
  })
  status!: LeadStatus;
}

export type LeadDocument = Lead & Document;
export const LeadSchema = SchemaFactory.createForClass(Lead);
