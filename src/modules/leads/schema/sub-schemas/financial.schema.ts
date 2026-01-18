import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class FinancialDetails {
    @Prop({ default: 0 })
    assetsCheckingAcct: number;

    @Prop({ default: 0 })
    assetsSavingsAcct: number;

    @Prop({ default: 0 })
    assetsStocksBonds: number;

    @Prop({ default: 0 })
    assetsRealEstate: number;

    @Prop({ default: 0 })
    totalAssets: number;

    @Prop({ default: 0 })
    totalLiabilities: number;

    @Prop({ default: 0 })
    netWorth: number;

    @Prop({ default: 0 })
    creditScore: number;

    @Prop({ default: 0 })
    liquidAssets: number;

    @Prop({ default: '' })
    guarantorSsn: string;

    @Prop({ default: '' })
    guarantor: string;

    @Prop({ default: 0 })
    annualIncome: number;

    @Prop({ default: '' })
    sourceOfIncome: string;

    @Prop({ default: '' })
    qualifier: string;
}

export const FinancialDetailsSchema = SchemaFactory.createForClass(FinancialDetails);
