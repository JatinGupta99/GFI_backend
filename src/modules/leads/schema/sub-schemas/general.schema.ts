import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Property } from '../../../properties/schema/property.entity';

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
    dob: string;

    @Prop({ default: '' })
    jobTitle: string;

    @Prop({ default: '' })
    ssn: string;

    @Prop({ default: '' })
    spouseName: string;

    @Prop({ default: '' })
    businessName: string;


    @Prop({ default: '' })
    spouseSsn: string;
    @Prop({ default: '' })
    mailingAddress: string;

    @Prop({ default: '' })
    residentialAddress: string;

    @Prop({ default: '' })
    howLongAtAddress: string;

    @Prop({ default: '' })
    presentEmployer: string;

    @Prop({ default: '' })
    businessExperienceSummary: string;

    @Prop({ default: false })
    hasCoApplicant: boolean;

    @Prop({ default: false })
    driversLicenseUploaded: boolean;

    @Prop({ type: String, ref: Property.name, required: true })
    property: string;

    @Prop({ default: '' })
    suite: string;

    @Prop({ default: '' })
    sf: string;

    @Prop({ default: '' })
    notes?: string;
}

export const GeneralDetailsSchema = SchemaFactory.createForClass(GeneralDetails);
