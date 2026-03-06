import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Activity extends Document {
    @Prop({ type: String, required: true })
    activityName: string;

    @Prop({ type: String })
    department: string;

    @Prop({ type: String, required: true })
    createdBy?: string=''; // User Name

    @Prop({ type: String })
    updatedBy?: string=''; // User Name

    @Prop({ type: String, required: true })
    leadId: string;

    @Prop({ type: String })
    fileKey: string='';

    // Follow-up scheduling fields
    @Prop({ type: Date })
    followUpDate?: Date; // When the follow-up should be executed

    @Prop({ type: Boolean, default: false })
    isAutomatedFollowUp?: boolean; // Whether this is an automated follow-up

    @Prop({ type: Boolean, default: false })
    followUpCompleted?: boolean; // Whether the follow-up has been processed

    @Prop({ type: String })
    originalEmailSubject?: string; // Original email subject for context

    @Prop({ type: String })
    followUpType?: string; // Type of follow-up (email, call, etc.)
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);
