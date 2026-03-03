import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DocumentDocument = DocumentEntity & Document;

@Schema({ timestamps: true })
export class DocumentEntity {
  _id?: Types.ObjectId;

  @Prop({ required: true, unique: true })
  key: string;

  @Prop({ required: true })
  fileName: string;

  @Prop({ required: true })
  originalFileName: string;

  @Prop({ required: true })
  contentType: string;

  @Prop({ required: true })
  size: number;

  @Prop()
  folder?: string;

  @Prop()
  uploadedBy?: string;

  @Prop()
  description?: string;

  @Prop()
  category?: string;

  @Prop({ type: Object })
  tags?: Record<string, string>;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop({ default: 'pending' })
  status: 'pending' | 'uploaded' | 'failed';

  @Prop()
  uploadedAt?: Date;

  @Prop()
  expiresAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const DocumentSchema = SchemaFactory.createForClass(DocumentEntity);

// Index for efficient queries
DocumentSchema.index({ key: 1 });
DocumentSchema.index({ uploadedBy: 1 });
DocumentSchema.index({ category: 1 });
DocumentSchema.index({ status: 1 });
DocumentSchema.index({ createdAt: -1 });