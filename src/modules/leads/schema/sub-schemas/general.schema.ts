import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class GeneralDetails {
    @Prop({ default: '' })
    firstName: string;

    @Prop({ default: '' })
    lastName: string;

    @Prop({ default: '' })
    email: string;

    @Prop({ default: '' })
    cellPhone: string;

    @Prop({ default: '' })
    workPhone: string;

    @Prop({ default: '' })
    jobTitle: string;

    @Prop({ default: '' })
    spouseName: string;

    @Prop({ default: '' })
    businessName: string;

    @Prop({ default: '' })
    mailingAddress: string;

    @Prop({ default: '' })
    residentialAddress: string;

    @Prop({ default: '' })
    city: string;

    @Prop({ default: '' })
    state: string;

    @Prop({ default: '' })
    zip: string;

    @Prop({ default: '' })
    use: string;

    @Prop({ default: '' })
    property: string;

    @Prop({ default: '' })
    suite: string;
}

export const GeneralDetailsSchema = SchemaFactory.createForClass(GeneralDetails);
