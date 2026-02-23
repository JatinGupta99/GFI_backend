import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class AnnualPMT {
    @Prop({ default: 0 })
    janPmt: number;

    @Prop({ default: 0 })
    febPmt: number;

    @Prop({ default: 0 })
    marPmt: number;

    @Prop({ default: 0 })
    aprPmt: number;

    @Prop({ default: 0 })
    mayPmt: number;

    @Prop({ default: 0 })
    junPmt: number;

    @Prop({ default: 0 })
    julPmt: number;

    @Prop({ default: 0 })
    augPmt: number;

    @Prop({ default: 0 })
    septPmt: number;

    @Prop({ default: 0 })
    octPmt: number;

    @Prop({ default: 0 })
    novPmt: number;

    @Prop({ default: 0 })
    decPmt: number;
}

export const AnnualPMTSchema = SchemaFactory.createForClass(AnnualPMT);

@Schema({ _id: false })
export class AccountingDetails {
    @Prop({ default: 0 })
    baseRent: number;

    @Prop({ default: 0 })
    cam: number;

    @Prop({ default: 0 })
    ins: number;

    @Prop({ default: 0 })
    tax: number;

    @Prop({ default: 0 })
    totalDue: number;

    @Prop({ default: 0 })
    balanceDue: number;

    @Prop({ default: '' })
    status: string;

    @Prop({ default: '' })
    rentDueDate: string;

    @Prop({ default: '' })
    lateAfter: string;

    @Prop({ default: 0 })
    lateFee: number;

    @Prop({ type: AnnualPMTSchema, default: () => ({}) })
    annualPMT: AnnualPMT;
}

export const AccountingDetailsSchema = SchemaFactory.createForClass(AccountingDetails);
