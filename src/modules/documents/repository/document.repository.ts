import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DocumentEntity, DocumentDocument } from '../schema/document.schema';

@Injectable()
export class DocumentRepository {
  constructor(
    @InjectModel(DocumentEntity.name)
    private documentModel: Model<DocumentDocument>,
  ) {}

  async create(documentData: Partial<DocumentEntity>): Promise<DocumentEntity> {
    const document = new this.documentModel(documentData);
    return document.save();
  }

  async findByKey(key: string): Promise<DocumentEntity | null> {
    return this.documentModel.findOne({ key }).exec();
  }

  async findById(id: string): Promise<DocumentEntity | null> {
    return this.documentModel.findById(id).exec();
  }

  async findByUploadedBy(
    uploadedBy: string,
    options?: {
      limit?: number;
      skip?: number;
      category?: string;
      status?: string;
    },
  ): Promise<DocumentEntity[]> {
    const query = this.documentModel.find({ uploadedBy });

    if (options?.category) {
      query.where({ category: options.category });
    }

    if (options?.status) {
      query.where({ status: options.status });
    }

    if (options?.skip) {
      query.skip(options.skip);
    }

    if (options?.limit) {
      query.limit(options.limit);
    }

    return query.sort({ createdAt: -1 }).exec();
  }

  async updateStatus(key: string, status: 'pending' | 'uploaded' | 'failed', uploadedAt?: Date): Promise<DocumentEntity | null> {
    const updateData: any = { status };
    if (uploadedAt) {
      updateData.uploadedAt = uploadedAt;
    }

    return this.documentModel
      .findOneAndUpdate({ key }, updateData, { new: true })
      .exec();
  }

  async updateMetadata(key: string, metadata: Partial<DocumentEntity>): Promise<DocumentEntity | null> {
    return this.documentModel
      .findOneAndUpdate({ key }, metadata, { new: true })
      .exec();
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.documentModel.deleteOne({ key }).exec();
    return result.deletedCount > 0;
  }

  async findExpiredDocuments(beforeDate: Date): Promise<DocumentEntity[]> {
    return this.documentModel
      .find({
        status: 'pending',
        expiresAt: { $lt: beforeDate },
      })
      .exec();
  }

  async count(filters?: {
    uploadedBy?: string;
    category?: string;
    status?: string;
  }): Promise<number> {
    const query = this.documentModel.countDocuments();

    if (filters?.uploadedBy) {
      query.where({ uploadedBy: filters.uploadedBy });
    }

    if (filters?.category) {
      query.where({ category: filters.category });
    }

    if (filters?.status) {
      query.where({ status: filters.status });
    }

    return query.exec();
  }

  async findAll(options?: {
    limit?: number;
    skip?: number;
    category?: string;
    status?: string;
    uploadedBy?: string;
  }): Promise<DocumentEntity[]> {
    const query = this.documentModel.find();

    if (options?.uploadedBy) {
      query.where({ uploadedBy: options.uploadedBy });
    }

    if (options?.category) {
      query.where({ category: options.category });
    }

    if (options?.status) {
      query.where({ status: options.status });
    }

    if (options?.skip) {
      query.skip(options.skip);
    }

    if (options?.limit) {
      query.limit(options.limit);
    }

    return query.sort({ createdAt: -1 }).exec();
  }
}