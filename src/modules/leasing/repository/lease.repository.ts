import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { Lease, LeaseDocument, SignatureStatus } from '../schema/lease.schema';

@Injectable()
export class LeaseRepository {
  constructor(
    @InjectModel(Lease.name) private model: Model<LeaseDocument>,
  ) {}

  async create(leaseData: Partial<Lease>): Promise<LeaseDocument> {
    const lease = new this.model(leaseData);
    return lease.save();
  }

  async findById(id: string): Promise<LeaseDocument> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid lease ID');
    }
    const lease = await this.model.findById(id).exec();
    if (!lease) {
      throw new NotFoundException('Lease not found');
    }
    return lease;
  }

  async findByEnvelopeId(envelopeId: string): Promise<LeaseDocument | null> {
    return this.model.findOne({ docusignEnvelopeId: envelopeId }).exec();
  }

  async updateEnvelopeId(
    leaseId: string,
    envelopeId: string,
  ): Promise<LeaseDocument> {
    if (!isValidObjectId(leaseId)) {
      throw new BadRequestException('Invalid lease ID');
    }
    const updated = await this.model
      .findByIdAndUpdate(
        leaseId,
        {
          docusignEnvelopeId: envelopeId,
          signatureStatus: SignatureStatus.PENDING_SIGNATURE,
          sentForSignatureAt: new Date(),
        },
        { new: true },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException('Lease not found');
    }
    return updated;
  }

  async updateSignedDocument(
    leaseId: string,
    signedDocumentUrl: string,
  ): Promise<LeaseDocument> {
    if (!isValidObjectId(leaseId)) {
      throw new BadRequestException('Invalid lease ID');
    }
    const updated = await this.model
      .findByIdAndUpdate(
        leaseId,
        {
          signedDocumentUrl,
          signatureStatus: SignatureStatus.SIGNED,
          signedAt: new Date(),
        },
        { new: true },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException('Lease not found');
    }
    return updated;
  }

  /**
   * Update lease signature status
   * Used for declined and voided envelopes
   */
  async updateLeaseStatus(
    leaseId: string,
    status: SignatureStatus | string,
  ): Promise<LeaseDocument> {
    if (!isValidObjectId(leaseId)) {
      throw new BadRequestException('Invalid lease ID');
    }
    const updated = await this.model
      .findByIdAndUpdate(
        leaseId,
        {
          signatureStatus: status,
        },
        { new: true },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException('Lease not found');
    }
    return updated;
  }

  async findAll(): Promise<LeaseDocument[]> {
    return this.model.find().exec();
  }
}