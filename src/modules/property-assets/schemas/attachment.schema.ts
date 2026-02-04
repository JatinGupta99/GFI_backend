import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Attachment extends Document {
    @Prop({ type: String, required: true })
    fileName: string;

    @Prop({ type: String, required: true })
    fileKey: string; // S3 Key

    @Prop({ type: String, required: true })
    createdBy: string; // User Name

    @Prop({ type: String })
    updatedBy?: string; // User Name

    @Prop({ type: String, required: true })
    propertyId: string;

    @Prop({ type: String })
    category?: string; // e.g., 'Lease', 'Plan', 'Survey'
}

export const AttachmentSchema = SchemaFactory.createForClass(Attachment);
