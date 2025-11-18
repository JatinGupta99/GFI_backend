import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { Suite } from "../../suites/schema/suite.schema";

@Schema({ timestamps: true,versionKey:false })
export class Property {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  region: string; // FL, TX

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Suite' }] })
  suites: Suite[];
}

export type PropertyDocument = Property & Document;
export const PropertySchema = SchemaFactory.createForClass(Property);
