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

  @Prop({ trim: true })
  cellPhone?: string;

  @Prop({ trim: true })
  workPhone?: string;

  @Prop({ trim: true })
  businessName?: string;

  @Prop({ trim: true })
  mailingAddress?: string;

  @Prop({ trim: true })
  use?: string;

  @Prop({ trim: true })
  property?: string;

  @Prop({ trim: true })
  suite?: string;

  @Prop({
    type: String,
    enum: Object.values(LeadStatus),
    default: LeadStatus.PROSPECT,
    index: true,
  })
  status!: LeadStatus;

  @Prop({ trim: true, default: 'Note' })
  notes?: string;
}

export type LeadDocument = Lead & Document;
export const LeadSchema = SchemaFactory.createForClass(Lead);
