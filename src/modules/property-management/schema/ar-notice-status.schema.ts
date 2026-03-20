import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ARStatus } from '../dto/ar-balance.dto';

@Schema({ timestamps: true, versionKey: false })
export class ARNoticeStatus {
    @Prop({ type: String, required: true, unique: true, index: true })
    leaseId: string;

    @Prop({ type: String, enum: ARStatus, default: ARStatus.SENT_COURTESY_NOTICE })
    status: ARStatus;

    @Prop({ type: Date })
    lastActivity: Date;

    @Prop({ type: String })
    note: string;
}

export type ARNoticeStatusDocument = ARNoticeStatus & Document;
export const ARNoticeStatusSchema = SchemaFactory.createForClass(ARNoticeStatus);
