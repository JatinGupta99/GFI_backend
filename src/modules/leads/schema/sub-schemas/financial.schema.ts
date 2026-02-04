import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
@Schema({ _id: false })
export class Assets {
    @Prop({ default: false })
    checkingSavings: boolean;

    @Prop({ default: false })
    stocksBonds: boolean;

    @Prop({ default: false })
    retirementAccounts: boolean;

    @Prop({ default: '' })
    automobiles: string;

    @Prop({ default: '' })
    realEstateResidence: string;

    @Prop({ default: '' })
    realEstateInvestment: string;

    @Prop({ default: '' })
    otherAssets: string;
}

@Schema({ _id: false })
export class Liabilities {
    @Prop({ default: '' })
    creditCardBalances: string;

    @Prop({ default: '' })
    taxesPayable: string;

    @Prop({ default: '' })
    mortgagesDue: string;

    @Prop({ default: '' })
    otherLiabilities: string;
}

@Schema({ _id: false })
export class FinancialDetails {
    @Prop({ type: Assets, default: () => ({}) })
    assets: Assets;

    @Prop({ type: Liabilities, default: () => ({}) })
    liabilities: Liabilities;

    @Prop({ default: '' })
    annualIncome: string;

    @Prop({ default: '' })
    monthlyMortgageRent: string;
}

export const FinancialDetailsSchema = SchemaFactory.createForClass(FinancialDetails);
