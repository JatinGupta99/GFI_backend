import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
@Schema({ _id: false })
export class ProfessionalReference {
    @Prop({ default: '' })
    name: string;

    @Prop({ default: '' })
    phone: string;
}

@Schema({ _id: false })
export class ReferenceInfo {
    @Prop({ default: '' })
    bankReference: string;

    @Prop({ default: '' })
    bankOfficerName: string;

    @Prop({ default: '' })
    bankOfficerPhone: string;

    @Prop({ type: ProfessionalReference, default: () => ({}) })
    professionalReference1: ProfessionalReference;

    @Prop({ type: ProfessionalReference, default: () => ({}) })
    professionalReference2: ProfessionalReference;
}

export const ReferenceInfoSchema = SchemaFactory.createForClass(ReferenceInfo);
