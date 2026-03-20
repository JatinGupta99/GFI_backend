import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class ActivityLog {
    @Prop({ default: '' })
    id: string;

    @Prop({ default: '' })
    type: string;

    @Prop({ default: '' })
    description: string;

    @Prop({ default: '' })
    createdBy: string;

    @Prop({ default: null })
    createdDate: Date;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);
