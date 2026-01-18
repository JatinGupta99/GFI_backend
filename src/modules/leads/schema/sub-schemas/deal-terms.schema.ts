import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class NegotiationValues {
    @Prop({ default: '' })
    term: string;

    @Prop({ default: 0 })
    baseRent: number;

    @Prop({ default: '' })
    annualIncrease: string;

    @Prop({ default: '' })
    rcd: string;

    @Prop({ default: 0 })
    nnn: number;

    @Prop({ default: '' })
    camCap: string;

    @Prop({ default: '' })
    camCapDetails: string;

    @Prop({ default: '' })
    insReimbursement: string;

    @Prop({ default: '' })
    insReimbursementDetails: string;
}

const NegotiationValuesSchema = SchemaFactory.createForClass(NegotiationValues);

@Schema({ _id: false })
export class Agreement {
    @Prop({ default: false })
    term: boolean;

    @Prop({ default: false })
    baseRent: boolean;

    @Prop({ default: false })
    annualIncrease: boolean;

    @Prop({ default: false })
    rcd: boolean;

    @Prop({ default: false })
    nnn: boolean;

    @Prop({ default: false })
    camCap: boolean;

    @Prop({ default: false })
    camCapDetails: boolean;

    @Prop({ default: false })
    insReimbursement: boolean;

    @Prop({ default: false })
    insReimbursementDetails: boolean;
}

const AgreementSchema = SchemaFactory.createForClass(Agreement);

@Schema({ _id: false })
export class NegotiationProposal {
    @Prop({ default: '' })
    label: string;

    @Prop({ type: NegotiationValuesSchema, default: () => ({}) })
    values: NegotiationValues;
}

const NegotiationProposalSchema = SchemaFactory.createForClass(NegotiationProposal);

@Schema({ _id: false })
export class NegotiationRound {
    @Prop({ default: '' })
    id: string;

    @Prop({ default: '' })
    label: string;

    @Prop({ type: NegotiationProposalSchema, default: () => ({}) })
    initial: NegotiationProposal;

    @Prop({ type: NegotiationProposalSchema, default: () => ({}) })
    counter: NegotiationProposal;

    @Prop({ type: AgreementSchema, default: () => ({}) })
    agreement: Agreement;
}

const NegotiationRoundSchema = SchemaFactory.createForClass(NegotiationRound);

@Schema({ _id: false })
export class DealTerms {
    @Prop({ type: [NegotiationRoundSchema], default: [] })
    rounds: NegotiationRound[];
}

export const DealTermsSchema = SchemaFactory.createForClass(DealTerms);
