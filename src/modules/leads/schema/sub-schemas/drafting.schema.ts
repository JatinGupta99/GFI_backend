import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class DraftingDetails {
    @Prop({ default: 0 })
    rentPerSf: number;

    @Prop({ default: 0 })
    annInc: number;

    @Prop({ default: 0 })
    freeMonths: number;

    @Prop({ default: '' })
    ti: string;

    @Prop({ default: 0 })
    tiPerSf: number;

    @Prop({ default: '' })
    rcd: string;
}

export const DraftingDetailsSchema = SchemaFactory.createForClass(DraftingDetails);
