import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class BrokerInfo {
    @Prop({ default: '' })
    brokerParticipation: string;

    @Prop({ default: '' })
    companyName: string;

    @Prop({ default: '' })
    companyAddress: string;

    @Prop({ default: '' })
    companyPhone: string;

    @Prop({ default: '' })
    contactName: string;

    @Prop({ default: '' })
    email: string;

    @Prop({ default: '' })
    phone: string;

    @Prop({ default: '' })
    commissionStructure: string;

    @Prop({ default: 0 })
    commissionAmount: number;
}

export const BrokerInfoSchema = SchemaFactory.createForClass(BrokerInfo);
