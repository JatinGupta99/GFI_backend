import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MediaService {
  private s3Client: S3Client;
  private bucketName: string;
  private allowedImageTypes: string[];
  private allowedDocumentTypes: string[];
  private maxImageSizeMb: number;
  private maxDocumentSizeMb: number;
  private downloadUrlExpire: number;

  constructor(private configService: ConfigService) {
    const awsConfig = this.configService.get('aws');
    if (!awsConfig?.bucket || !awsConfig?.region) {
      throw new InternalServerErrorException('AWS S3 configuration missing');
    }
    this.bucketName = awsConfig.bucket;
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

    const mediaConfig = this.configService.get('media') || {};
    this.allowedImageTypes = mediaConfig.allowedImageTypes || [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];
    this.allowedDocumentTypes = mediaConfig.allowedDocumentTypes || ['application/pdf'];
    this.maxImageSizeMb = mediaConfig.maxImageSizeMb || 5;
    this.maxDocumentSizeMb = mediaConfig.maxDocumentSizeMb || 10;
    this.downloadUrlExpire = mediaConfig.downloadUrlExpire || 900;
  }

  private validateFile(contentType: string, sizeMb?: number) {
    const isImage = this.allowedImageTypes.includes(contentType);
    const isDocument = this.allowedDocumentTypes.includes(contentType);

    if (isImage) {
      if (sizeMb && sizeMb > this.maxImageSizeMb) {
        throw new BadRequestException(
          `Image size ${sizeMb}MB exceeds max ${this.maxImageSizeMb}MB`,
        );
      }
    } else if (isDocument) {
      if (sizeMb && sizeMb > this.maxDocumentSizeMb) {
        throw new BadRequestException(
          `Document size ${sizeMb}MB exceeds max ${this.maxDocumentSizeMb}MB`,
        );
      }
    } else {
      throw new BadRequestException(`File type ${contentType} not allowed. Supported: ${[...this.allowedImageTypes, ...this.allowedDocumentTypes].join(', ')}`);
    }
  }

  private generateKey(folderPath: string, contentType: string) {
    const extension = contentType.split('/')[1];
    return `${folderPath}/${uuidv4()}.${extension}`;
  }

  async generateUploadUrl(
    folderPath: string,
    contentType: string,
    sizeMb?: number,
    downloadUrlExpire = this.downloadUrlExpire,
  ) {
    this.validateFile(contentType, sizeMb);
    const key = this.generateKey(folderPath, contentType);
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.s3Client, command, { expiresIn: downloadUrlExpire });
    return { key, url };
  }

  async uploadFile(buffer: Buffer, contentType: string, folderPath: string): Promise<{ key: string; url: string }> {
    this.validateFile(contentType);
    const key = this.generateKey(folderPath, contentType);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    try {
      await this.s3Client.send(command);
      // Generate a signed URL for immediate access if needed, or just return the key
      // Returning a signed URL with default expiry for convenience
      const url = await getSignedUrl(this.s3Client, new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }), { expiresIn: this.downloadUrlExpire });

      return { key, url };
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw new InternalServerErrorException('Failed to upload file to S3');
    }
  }

  async generateDownloadUrl(key: string, downloadUrlExpire = this.downloadUrlExpire) {
    const filename = key.split('/').pop();
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ResponseContentDisposition: `inline; filename="${filename}"`,
    });
    try {
      return await getSignedUrl(this.s3Client, command, { expiresIn: downloadUrlExpire });
    } catch (error) {
      console.error('Failed to generate download URL:', error);
      throw new InternalServerErrorException('Failed to generate download URL');
    }
  }

  async moveFile(oldKey: string, newKey: string) {
    try {
      await this.s3Client.send(
        new CopyObjectCommand({
          Bucket: this.bucketName,
          CopySource: `${this.bucketName}/${oldKey}`,
          Key: newKey,
        }),
      );
      await this.s3Client.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: oldKey }));
    } catch (error) {
      console.error('Failed to move file:', error);
      throw new InternalServerErrorException('Failed to move file in S3');
    }
  }

  async deleteFile(key: string) {
    try {
      await this.s3Client.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }));
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw new InternalServerErrorException('Failed to delete file in S3');
    }
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      const response = await this.s3Client.send(command);
      if (!response.Body) {
        throw new InternalServerErrorException('File body is empty');
      }
      const byteArray = await response.Body.transformToByteArray();
      return Buffer.from(byteArray);
    } catch (error) {
      console.error('Failed to get file buffer:', error);
      throw new InternalServerErrorException('Failed to retrieve file from S3');
    }
  }

  getFolderByContentType(contentType: string): string {
    if (this.allowedImageTypes.includes(contentType)) return 'images';
    if (this.allowedDocumentTypes.includes(contentType)) return 'documents';
    throw new BadRequestException(`Unsupported content type: ${contentType}`);
  }
}
