import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class BusinessDetails {
    @Prop({ default: '' })
    legalName: string;

    @Prop({ default: '' })
    taxId: string;

    @Prop({ default: '' })
    typeOfEntity: string;

    @Prop({ default: '' })
    stateOfIncorporation: string;

    @Prop({ default: '' })
    corporateAddress: string;

    @Prop({ default: '' })
    businessTelephone: string;

    @Prop({ default: '' })
    businessDescription: string;

    @Prop({ default: '' })
    tradeName: string;

    @Prop({ default: 0 })
    yearsInBusiness: number;

    @Prop({ default: false })
    areYouLicensed: boolean;

    @Prop({ default: 0 })
    numLocations: number;

    @Prop({ default: false })
    areYouRelocating: boolean;
}

export const BusinessDetailsSchema = SchemaFactory.createForClass(BusinessDetails);
