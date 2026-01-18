import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class ReferenceInfo {
    @Prop({ default: '' })
    id: string;

    @Prop({ default: '' })
    type: string;

    @Prop({ default: '' })
    name: string;

    @Prop({ default: '' })
    phone: string;

    @Prop({ default: '' })
    email?: string;

    @Prop({ default: '' })
    relationship?: string;
}

export const ReferenceInfoSchema = SchemaFactory.createForClass(ReferenceInfo);
