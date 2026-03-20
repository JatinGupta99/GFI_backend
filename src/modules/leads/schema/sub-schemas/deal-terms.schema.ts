import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class NegotiationValues {
    @Prop({ default: '' }) term: string;
    @Prop({ default: 0 }) baseRent: number;
    @Prop({ default: '' }) annualIncrease: string;
    @Prop({ default: '' }) rcd: string;
    @Prop({ default: 0 }) nnn: number;
    @Prop({ default: '' }) camCap: string;
    @Prop({ default: '' }) camCapDetails: string;
    @Prop({ default: '' }) insReimbursement: string;
    @Prop({ default: '' }) insReimbursementDetails: string;
    @Prop({ default: '' }) retReimbursement: string;
    @Prop({ default: '' }) retReimbursementDetails: string;
    @Prop({ default: '' }) securityDeposit: string;
    @Prop({ default: '' }) securityDepositDetails: string;
    @Prop({ default: '' }) prepaidRent: string;
    @Prop({ default: '' }) use: string;
    @Prop({ default: '' }) exclusiveUse: string;
    @Prop({ default: '' }) option: string;
    @Prop({ default: '' }) optionDetails: string;
    @Prop({ default: '' }) guaranty: string;
    @Prop({ default: '' }) guarantyDetails: string;
    @Prop({ default: '' }) tiAllowance: string;
    @Prop({ default: '' }) tiAllowanceDetails: string;
    @Prop({ default: '' }) percentageRent: string;
    @Prop({ default: '' }) percentageRentDetails: string;
    @Prop({ default: '' }) deliveryOfSpace: string;
}

const NegotiationValuesSchema = SchemaFactory.createForClass(NegotiationValues);

@Schema({ _id: false })
export class NegotiationRound {
    @Prop({ default: '' }) id: string;
    @Prop({ default: '' }) label: string; // e.g. "Round 1", "Round 2", "Round 3"

    @Prop({ type: NegotiationValuesSchema, default: () => ({}) })
    initial: NegotiationValues;

    @Prop({ type: NegotiationValuesSchema, default: () => ({}) })
    counter: NegotiationValues;
}

const NegotiationRoundSchema = SchemaFactory.createForClass(NegotiationRound);

@Schema({ _id: false })
export class DealTerms {
    @Prop({ type: [NegotiationRoundSchema], default: [] })
    rounds: NegotiationRound[];
}

export const DealTermsSchema = SchemaFactory.createForClass(DealTerms);
