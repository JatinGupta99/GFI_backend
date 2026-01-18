import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

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
}

export const AccountingDetailsSchema = SchemaFactory.createForClass(AccountingDetails);
