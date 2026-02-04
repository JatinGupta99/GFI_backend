import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Activity extends Document {
    @Prop({ type: String, required: true })
    activityName: string;

    @Prop({ type: String })
    department?: string;

    @Prop({ type: String, required: true })
    createdBy: string; // User Name

    @Prop({ type: String })
    updatedBy?: string; // User Name

    @Prop({ type: String, required: true })
    propertyId: string;

    @Prop({ type: String })
    fileKey: string;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);
