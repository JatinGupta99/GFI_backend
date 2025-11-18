import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema()
export class DealStage {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: ['NEW', 'RENEWAL'] })
  type: string;

  @Prop({ required: true })
  order: number;
}

export type DealStageDocument = DealStage & Document;
export const DealStageSchema = SchemaFactory.createForClass(DealStage);
