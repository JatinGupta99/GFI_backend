import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { FormStatus } from '../../../common/enums/common-enums';

@Schema({ timestamps: true })
export class TenantFormProgress {
    @Prop({ type: Types.ObjectId, ref: 'Lead', required: true, index: true })
    tenant_id: Types.ObjectId;

    @Prop({ required: true, default: () => new Types.ObjectId().toString() })
    form_id: string;

    @Prop({ type: Object, default: {} })
    form_data: any;

    @Prop({
        type: String,
        enum: Object.values(FormStatus),
        default: FormStatus.CREATED,
    })
    status: FormStatus;

    @Prop({ default: Date.now })
    last_saved: Date;

    @Prop({ required: true, unique: true, index: true })
    tenant_token: string;

    @Prop({ required: true, index: true })
    expiresAt: Date;
}

export type TenantFormProgressDocument = TenantFormProgress & Document;
export const TenantFormProgressSchema = SchemaFactory.createForClass(TenantFormProgress);
