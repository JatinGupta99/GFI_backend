import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { S3DocumentStorageService } from './s3-document-storage.service';
import { DocumentValidatorService } from './document-validator.service';
import { DocumentRepository } from '../repository/document.repository';
import {
  DocumentUploadUrlDto,
  DocumentUploadUrlResult,
  DocumentDownloadUrlResult,
  DocumentInfoResult,
  DocumentListResult,
  DocumentListQueryDto,
  DocumentConfirmUploadDto,
  DocumentUpdateDto,
} from '../dto/document.dto';

@Injectable()
export class DocumentManagerService {
  private readonly logger = new Logger(DocumentManagerService.name);

  constructor(
    private readonly storageService: S3DocumentStorageService,
    private readonly validatorService: DocumentValidatorService,
    private readonly documentRepository: DocumentRepository,
  ) {}

  async generateUploadUrl(uploadUrlDto: DocumentUploadUrlDto): Promise<DocumentUploadUrlResult> {
    this.logger.log(`Generating upload URL for: ${uploadUrlDto.fileName}`);

    // Validate without buffer (pre-upload validation)
    const validation = await this.validatorService.validate({
      fileName: uploadUrlDto.fileName,
      contentType: uploadUrlDto.contentType,
      size: uploadUrlDto.size || 0,
    });

    if (!validation.isValid) {
      throw new BadRequestException(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Generate S3 upload URL
    const result = await this.storageService.generateUploadUrl({
      fileName: validation.sanitizedFileName || uploadUrlDto.fileName,
      contentType: uploadUrlDto.contentType,
      size: uploadUrlDto.size,
      folder: uploadUrlDto.folder,
      tags: uploadUrlDto.tags,
      metadata: {
        originalFileName: uploadUrlDto.fileName,
        uploadedBy: uploadUrlDto.uploadedBy,
        description: uploadUrlDto.description,
        category: uploadUrlDto.category,
        ...uploadUrlDto.metadata,
      },
    });

    // Store document metadata in database with pending status
    const document = await this.documentRepository.create({
      key: result.key,
      fileName: validation.sanitizedFileName || uploadUrlDto.fileName,
      originalFileName: uploadUrlDto.fileName,
      contentType: uploadUrlDto.contentType,
      size: uploadUrlDto.size || 0,
      folder: uploadUrlDto.folder,
      uploadedBy: uploadUrlDto.uploadedBy,
      description: uploadUrlDto.description,
      category: uploadUrlDto.category,
      tags: uploadUrlDto.tags,
      metadata: uploadUrlDto.metadata,
      status: 'pending',
      expiresAt: new Date(Date.now() + result.expiresIn * 1000), // Set expiration
    });

    this.logger.log(`Upload URL generated and document record created: ${result.key}`);

    return {
      key: result.key,
      uploadUrl: result.uploadUrl,
      expiresIn: result.expiresIn,
      fileName: validation.sanitizedFileName || uploadUrlDto.fileName,
      documentId: document._id?.toString() || '',
      warnings: validation.warnings,
    };
  }

  async confirmUpload(confirmDto: DocumentConfirmUploadDto): Promise<DocumentInfoResult> {
    this.logger.log(`Confirming upload for: ${confirmDto.key}`);

    const document = await this.documentRepository.findByKey(confirmDto.key);
    if (!document) {
      throw new NotFoundException('Document record not found');
    }

    // Update document status to uploaded
    const updatedDocument = await this.documentRepository.updateStatus(
      confirmDto.key,
      'uploaded',
      new Date(),
    );

    // Update actual size if provided
    if (confirmDto.actualSize && confirmDto.actualSize !== document.size && updatedDocument) {
      await this.documentRepository.updateMetadata(confirmDto.key, {
        size: confirmDto.actualSize,
      });
      updatedDocument.size = confirmDto.actualSize;
    }

    this.logger.log(`Upload confirmed for: ${confirmDto.key}`);

    return this.mapDocumentToResult(updatedDocument);
  }

  async generateDownloadUrl(
    key: string,
    options?: {
      expiresIn?: number;
      inline?: boolean;
      fileName?: string;
    },
  ): Promise<DocumentDownloadUrlResult> {
    this.logger.log(`Generating download URL for: ${key}`);

    // Check if document exists in database
    const document = await this.documentRepository.findByKey(key);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.status !== 'uploaded') {
      throw new BadRequestException(`Document is not available for download. Status: ${document.status}`);
    }

    const disposition = options?.inline 
      ? `inline; filename="${options?.fileName || document.fileName}"` 
      : `attachment; filename="${options?.fileName || document.fileName}"`;

    const url = await this.storageService.generateDownloadUrl(key, {
      expiresIn: options?.expiresIn,
      responseContentDisposition: disposition,
    });

    return {
      url,
      expiresIn: options?.expiresIn || 3600,
    };
  }

  async getDocumentInfo(key: string): Promise<DocumentInfoResult> {
    const document = await this.documentRepository.findByKey(key);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return this.mapDocumentToResult(document);
  }

  async getDocumentById(id: string): Promise<DocumentInfoResult> {
    const document = await this.documentRepository.findById(id);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return this.mapDocumentToResult(document);
  }

  async listDocuments(query: DocumentListQueryDto): Promise<DocumentListResult> {
    const { page = 1, limit = 20, ...filters } = query;
    const skip = (page - 1) * limit;

    const [documents, total] = await Promise.all([
      this.documentRepository.findAll({
        skip,
        limit,
        ...filters,
      }),
      this.documentRepository.count(filters),
    ]);

    const documentResults = await Promise.all(
      documents.map(doc => this.mapDocumentToResult(doc))
    );

    return {
      documents: documentResults,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateDocument(key: string, updateDto: DocumentUpdateDto): Promise<DocumentInfoResult> {
    this.logger.log(`Updating document: ${key}`);

    const document = await this.documentRepository.findByKey(key);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const updatedDocument = await this.documentRepository.updateMetadata(key, updateDto);
    
    this.logger.log(`Document updated: ${key}`);

    return this.mapDocumentToResult(updatedDocument);
  }

  async deleteDocument(key: string): Promise<void> {
    this.logger.log(`Deleting document: ${key}`);

    const document = await this.documentRepository.findByKey(key);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Delete from S3
    try {
      await this.storageService.delete(key);
    } catch (error) {
      this.logger.warn(`Failed to delete from S3: ${error.message}`);
      // Continue with database deletion even if S3 deletion fails
    }

    // Delete from database
    await this.documentRepository.delete(key);

    this.logger.log(`Document deleted: ${key}`);
  }

  async markUploadFailed(key: string): Promise<void> {
    this.logger.log(`Marking upload as failed: ${key}`);
    await this.documentRepository.updateStatus(key, 'failed');
  }

  async cleanupExpiredDocuments(): Promise<number> {
    this.logger.log('Cleaning up expired pending documents');

    const expiredDocuments = await this.documentRepository.findExpiredDocuments(new Date());
    let cleanedCount = 0;

    for (const doc of expiredDocuments) {
      try {
        // Try to delete from S3 (might not exist if upload never completed)
        await this.storageService.delete(doc.key);
      } catch (error) {
        // Ignore S3 deletion errors for cleanup
      }

      // Delete from database
      await this.documentRepository.delete(doc.key);
      cleanedCount++;
    }

    this.logger.log(`Cleaned up ${cleanedCount} expired documents`);
    return cleanedCount;
  }

  private async mapDocumentToResult(document: any): Promise<DocumentInfoResult> {
    let downloadUrl: string | undefined;

    // Generate download URL for uploaded documents
    if (document.status === 'uploaded') {
      try {
        downloadUrl = await this.storageService.generateDownloadUrl(document.key, {
          expiresIn: 3600, // 1 hour
        });
      } catch (error) {
        this.logger.warn(`Failed to generate download URL for ${document.key}: ${error.message}`);
      }
    }

    return {
      id: document._id?.toString() || '',
      key: document.key,
      fileName: document.fileName,
      originalFileName: document.originalFileName,
      contentType: document.contentType,
      size: document.size,
      status: document.status,
      folder: document.folder,
      uploadedBy: document.uploadedBy,
      description: document.description,
      category: document.category,
      tags: document.tags,
      createdAt: document.createdAt,
      uploadedAt: document.uploadedAt,
      downloadUrl,
    };
  }
}