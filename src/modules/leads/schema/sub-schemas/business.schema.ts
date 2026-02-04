import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class BusinessDetails {
    @Prop({ default: '' })
    legalName: string;

    @Prop({ default: '' })
    fein: string; // updated from taxId

    @Prop({ default: '' })
    stateOfIncorporation: string;

    @Prop({ default: '' })
    tradeName: string;

    @Prop({ default: '' })
    currentBusinessAddress: string;

    @Prop({ default: '' })
    proposedBusinessDescription: string;

    @Prop({ default: '' })
    businessTelephone: string;

    @Prop({ default: '' })
    isRelocating: string;

    @Prop({ default: '' })
    howLongInBusiness: string;

    @Prop({ default: '' })
    howManyLocations: string;
}

export const BusinessDetailsSchema = SchemaFactory.createForClass(BusinessDetails);
