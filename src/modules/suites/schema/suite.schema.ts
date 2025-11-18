import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

@Schema({ timestamps: true })
export class Suite {
  @Prop({ required: true })
  number: string;

  @Prop({ required: true })
  squareFootage: number;

  @Prop({
    enum: ['Vacant', 'Occupied', 'ComingSoon'],
    default: 'Vacant',
  })
  status: string;

  @Prop()
  budgetBaseRent: number;

  @Prop()
  budgetTI: number;

  @Prop()
  budgetRCD: Date;

  @Prop({ type: Types.ObjectId, ref: 'Property', required: true })
  propertyId: string;
}

export type SuiteDocument = Suite & Document;
export const SuiteSchema = SchemaFactory.createForClass(Suite);
