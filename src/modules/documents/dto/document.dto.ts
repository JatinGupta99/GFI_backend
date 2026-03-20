import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsObject, IsArray, IsBoolean, IsEnum } from 'class-validator';

export class DocumentUploadUrlDto {
  @ApiProperty({ description: 'Original file name' })
  @IsString()
  fileName: string;

  @ApiProperty({ description: 'MIME content type' })
  @IsString()
  contentType: string;

  @ApiProperty({ description: 'File size in bytes', required: false })
  @IsOptional()
  @IsNumber()
  size?: number;

  @ApiProperty({ description: 'Folder path for organization', required: false })
  @IsOptional()
  @IsString()
  folder?: string;

  @ApiProperty({ description: 'User who will upload the document', required: false })
  @IsOptional()
  @IsString()
  uploadedBy?: string;

  @ApiProperty({ description: 'Document description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Document category', required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: 'Tags for the document', required: false })
  @IsOptional()
  @IsObject()
  tags?: Record<string, string>;

  @ApiProperty({ description: 'Additional metadata', required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class DocumentConfirmUploadDto {
  @ApiProperty({ description: 'Document key returned from upload URL generation' })
  @IsString()
  key: string;

  @ApiProperty({ description: 'Actual file size after upload', required: false })
  @IsOptional()
  @IsNumber()
  actualSize?: number;
}

export class DocumentDownloadOptionsDto {
  @ApiProperty({ description: 'URL expiration time in seconds', required: false, default: 3600 })
  @IsOptional()
  @IsNumber()
  expiresIn?: number;

  @ApiProperty({ description: 'Whether to display inline or as attachment', required: false, default: false })
  @IsOptional()
  @IsBoolean()
  inline?: boolean;

  @ApiProperty({ description: 'Custom filename for download', required: false })
  @IsOptional()
  @IsString()
  fileName?: string;
}

export class DocumentListQueryDto {
  @ApiProperty({ description: 'Page number', required: false, default: 1 })
  @IsOptional()
  @IsNumber()
  page?: number = 1;

  @ApiProperty({ description: 'Items per page', required: false, default: 20 })
  @IsOptional()
  @IsNumber()
  limit?: number = 20;

  @ApiProperty({ description: 'Filter by category', required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: 'Filter by status', required: false })
  @IsOptional()
  @IsEnum(['pending', 'uploaded', 'failed'])
  status?: 'pending' | 'uploaded' | 'failed';

  @ApiProperty({ description: 'Filter by uploader', required: false })
  @IsOptional()
  @IsString()
  uploadedBy?: string;
}

export class DocumentUpdateDto {
  @ApiProperty({ description: 'Document description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Document category', required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: 'Tags for the document', required: false })
  @IsOptional()
  @IsObject()
  tags?: Record<string, string>;

  @ApiProperty({ description: 'Additional metadata', required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

// Response DTOs
export class DocumentUploadUrlResult {
  @ApiProperty({ description: 'Unique document key' })
  key: string;

  @ApiProperty({ description: 'Pre-signed upload URL' })
  uploadUrl: string;

  @ApiProperty({ description: 'URL expiration time in seconds' })
  expiresIn: number;

  @ApiProperty({ description: 'Sanitized file name' })
  fileName: string;

  @ApiProperty({ description: 'Document ID in database' })
  documentId: string;

  @ApiProperty({ description: 'Validation warnings', required: false })
  warnings?: string[];
}

export class DocumentDownloadUrlResult {
  @ApiProperty({ description: 'Pre-signed download URL' })
  url: string;

  @ApiProperty({ description: 'URL expiration time in seconds' })
  expiresIn: number;
}

export class DocumentInfoResult {
  @ApiProperty({ description: 'Document ID' })
  id: string;

  @ApiProperty({ description: 'Document key in S3' })
  key: string;

  @ApiProperty({ description: 'Original file name' })
  fileName: string;

  @ApiProperty({ description: 'Sanitized file name' })
  originalFileName: string;

  @ApiProperty({ description: 'MIME content type' })
  contentType: string;

  @ApiProperty({ description: 'File size in bytes' })
  size: number;

  @ApiProperty({ description: 'Upload status' })
  status: 'pending' | 'uploaded' | 'failed';

  @ApiProperty({ description: 'Folder path', required: false })
  folder?: string;

  @ApiProperty({ description: 'Uploader', required: false })
  uploadedBy?: string;

  @ApiProperty({ description: 'Description', required: false })
  description?: string;

  @ApiProperty({ description: 'Category', required: false })
  category?: string;

  @ApiProperty({ description: 'Tags', required: false })
  tags?: Record<string, string>;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Upload completion timestamp', required: false })
  uploadedAt?: Date;

  @ApiProperty({ description: 'Download URL if available', required: false })
  downloadUrl?: string;
}

export class DocumentListResult {
  @ApiProperty({ description: 'List of documents', type: [DocumentInfoResult] })
  documents: DocumentInfoResult[];

  @ApiProperty({ description: 'Total count' })
  total: number;

  @ApiProperty({ description: 'Current page' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;

  @ApiProperty({ description: 'Total pages' })
  totalPages: number;
}