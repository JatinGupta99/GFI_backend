import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { PropertyName } from '../enums/property-name.enum';

@Schema({ timestamps: true, versionKey: false })
export class Property {
  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true,
  })
  propertyId: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(PropertyName),
  })
  propertyName: PropertyName;

  @Prop({
    type: String,
    required: true,
  })
  region: string;
}

export type PropertyDocument = Property & Document;
export const PropertySchema = SchemaFactory.createForClass(Property);
