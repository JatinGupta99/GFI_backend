import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum SignatureStatus {
  DRAFT = 'DRAFT',
  PENDING_SIGNATURE = 'PENDING_SIGNATURE',
  SIGNED = 'SIGNED',
  VOIDED = 'VOIDED',
}

@Schema({ timestamps: true })
export class Lease {
  @Prop({ type: String, required: false })
  docusignEnvelopeId?: string;

  @Prop({
    type: String,
    enum: Object.values(SignatureStatus),
    default: SignatureStatus.DRAFT,
  })
  signatureStatus: SignatureStatus;

  @Prop({ type: String, required: false })
  signedDocumentUrl?: string;

  @Prop({ type: Date, required: false })
  sentForSignatureAt?: Date;

  @Prop({ type: Date, required: false })
  signedAt?: Date;

  // Add other lease fields as needed by the application
  // These are placeholder fields that would typically exist in a lease entity
  @Prop({ type: String, required: true })
  tenantEmail: string;

  @Prop({ type: String, required: true })
  tenantName: string;

  @Prop({ type: String, required: false })
  pdfDocumentUrl?: string;

  @Prop({ type: String, required: false })
  propertyId?: string;

  @Prop({ type: String, required: false })
  suiteId?: string;
}

export type LeaseDocument = Lease & Document;
export const LeaseSchema = SchemaFactory.createForClass(Lease);
