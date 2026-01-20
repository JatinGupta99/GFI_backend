import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { PropertyList } from '../../../common/enums/common-enums';

export type TaskDocument = Task & Document;

export enum TaskPriority {
    LOW = 'Low',
    MEDIUM = 'Medium',
    HIGH = 'High',
}

@Schema()
export class Attachment {
    @Prop({ required: true })
    key: string;

    @Prop({ required: true })
    name: string;

    @Prop({ required: true })
    type: string;

    @Prop({ required: true })
    size: number;
}
export const AttachmentSchema = SchemaFactory.createForClass(Attachment);

@Schema({ timestamps: true })
export class Task {
    _id: string;

    @Prop({ required: true, trim: true })
    title: string;

    @Prop({ required: false, trim: true })
    description: string;

    @Prop({ type: String, required: true })
    ownerName: string;

    @Prop({ type: String, enum: PropertyList, required: true })
    property: PropertyList;

    @Prop({ type: String, enum: TaskPriority, default: TaskPriority.MEDIUM })
    priority: TaskPriority;

    @Prop({ type: Date, required: false })
    dueDate: Date;

    @Prop({ type: Boolean, default: false })
    isCompleted: boolean;

    @Prop({ type: Date })
    completedAt: Date;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'CompanyUser' })
    completedBy: string;

    @Prop({ type: [AttachmentSchema], default: [] })
    attachments: Attachment[];
}

export const TaskSchema = SchemaFactory.createForClass(Task);
