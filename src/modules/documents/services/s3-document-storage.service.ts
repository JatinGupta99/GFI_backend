import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import {
  IDocumentStorage,
  DocumentMetadata,
  DocumentUploadResult,
  DocumentDownloadResult,
  DocumentUploadUrlResult,
  DownloadUrlOptions,
} from '../interfaces/document-storage.interface';

@Injectable()
export class S3DocumentStorageService implements IDocumentStorage {
  private s3Client: S3Client;
  private bucketName: string;
  private defaultExpiresIn: number;

  constructor(private configService: ConfigService) {
    try {
      const awsConfig = this.configService.get('aws');
      if (!awsConfig?.bucket || !awsConfig?.region) {
        // Set defaults to prevent crashes
        this.bucketName = 'default-bucket';
        this.defaultExpiresIn = 3600;
        return;
      }

      this.bucketName = awsConfig.bucket;
      this.defaultExpiresIn = awsConfig.defaultExpiresIn || 3600; // 1 hour

      this.s3Client = new S3Client({
        region: awsConfig.region,
        credentials:
          awsConfig.accessKeyId && awsConfig.secretAccessKey
            ? {
                accessKeyId: awsConfig.accessKeyId.trim(),
                secretAccessKey: awsConfig.secretAccessKey.trim(),
              }
            : undefined,
      });
    } catch (error) {
      // Set defaults to prevent crashes
      this.bucketName = 'default-bucket';
      this.defaultExpiresIn = 3600;
    }
  }

  private generateKey(metadata: DocumentMetadata): string {
    const folder = metadata.folder || 'documents';
    const extension = this.getFileExtension(metadata.fileName);
    const uniqueId = uuidv4();
    return `${folder}/${uniqueId}${extension}`;
  }

  private getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot !== -1 ? fileName.substring(lastDot) : '';
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  }

  async upload(file: Buffer, metadata: DocumentMetadata): Promise<DocumentUploadResult> {
    const key = this.generateKey(metadata);
    const sanitizedFileName = this.sanitizeFileName(metadata.fileName);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file,
      ContentType: metadata.contentType,
      Metadata: {
        originalFileName: sanitizedFileName,
        uploadedAt: new Date().toISOString(),
        ...metadata.metadata,
      },
      Tagging: metadata.tags
        ? Object.entries(metadata.tags)
            .map(([k, v]) => `${k}=${v}`)
            .join('&')
        : undefined,
    });

    try {
      await this.s3Client.send(command);

      return {
        key,
        size: file.length,
        contentType: metadata.contentType,
        uploadedAt: new Date(),
      };
    } catch (error) {
      throw new InternalServerErrorException(`Failed to upload file: ${error.message}`);
    }
  }

  async download(key: string): Promise<DocumentDownloadResult> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new InternalServerErrorException('File body is empty');
      }

      const buffer = Buffer.from(await response.Body.transformToByteArray());
      
      return {
        buffer,
        contentType: response.ContentType || 'application/octet-stream',
        fileName: response.Metadata?.originalFileName || key.split('/').pop() || 'download',
        size: buffer.length,
      };
    } catch (error) {
      throw new InternalServerErrorException(`Failed to download file: ${error.message}`);
    }
  }

  async generateUploadUrl(metadata: DocumentMetadata): Promise<DocumentUploadUrlResult> {
    const key = this.generateKey(metadata);
    const sanitizedFileName = this.sanitizeFileName(metadata.fileName);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: metadata.contentType,
      Metadata: {
        originalFileName: sanitizedFileName,
        uploadedAt: new Date().toISOString(),
        ...metadata.metadata,
      },
    });

    try {
      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: this.defaultExpiresIn,
      });

      return {
        key,
        uploadUrl,
        expiresIn: this.defaultExpiresIn,
      };
    } catch (error) {
      throw new InternalServerErrorException(`Failed to generate upload URL: ${error.message}`);
    }
  }

  async generateDownloadUrl(key: string, options?: DownloadUrlOptions): Promise<string> {
    const fileName = key.split('/').pop() || 'download';
    
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ResponseContentDisposition: 
        options?.responseContentDisposition || `inline; filename="${fileName}"`,
      ResponseContentType: options?.responseContentType,
    });

    try {
      return await getSignedUrl(this.s3Client, command, {
        expiresIn: options?.expiresIn || this.defaultExpiresIn,
      });
    } catch (error) {
      throw new InternalServerErrorException(`Failed to generate download URL: ${error.message}`);
    }
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      await this.s3Client.send(command);
    } catch (error) {
      throw new InternalServerErrorException(`Failed to delete file: ${error.message}`);
    }
  }

  async move(oldKey: string, newKey: string): Promise<void> {
    try {
      // Copy to new location
      await this.s3Client.send(
        new CopyObjectCommand({
          Bucket: this.bucketName,
          CopySource: `${this.bucketName}/${oldKey}`,
          Key: newKey,
        }),
      );

      // Delete old file
      await this.delete(oldKey);
    } catch (error) {
      throw new InternalServerErrorException(`Failed to move file: ${error.message}`);
    }
  }
}