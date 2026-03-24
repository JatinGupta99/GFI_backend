import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IDocumentValidator,
  DocumentValidationInput,
  DocumentValidationResult,
  DocumentValidationConfig,
} from '../interfaces/document-validator.interface';

@Injectable()
export class DocumentValidatorService implements IDocumentValidator {
  private config: DocumentValidationConfig;

  constructor(private configService: ConfigService) {
    try {
      const documentsConfig = this.configService.get('documents') || {};
      
      this.config = {
        allowedContentTypes: documentsConfig.allowedContentTypes || [
          // Images
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/svg+xml',
          // Documents
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          // Text
          'text/plain',
          'text/csv',
          'application/json',
          'application/xml',
          // Archives
          'application/zip',
          'application/x-rar-compressed',
          'application/x-7z-compressed',
        ],
        maxFileSize: documentsConfig.maxFileSize || 50 * 1024 * 1024, // 50MB
        minFileSize: documentsConfig.minFileSize || 1, // 1 byte
        allowedExtensions: documentsConfig.allowedExtensions || [
          '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
          '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
          '.txt', '.csv', '.json', '.xml',
          '.zip', '.rar', '.7z',
        ],
        blockedExtensions: documentsConfig.blockedExtensions || [
          '.exe', '.bat', '.cmd', '.com', '.scr', '.pif',
          '.js', '.vbs', '.jar', '.app', '.deb', '.pkg',
        ],
        scanForMalware: documentsConfig.scanForMalware || false,
      };
    } catch (error) {
      // Set safe defaults
      this.config = {
        allowedContentTypes: ['application/pdf', 'image/jpeg', 'image/png'],
        maxFileSize: 50 * 1024 * 1024,
        minFileSize: 1,
        allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
        blockedExtensions: ['.exe', '.bat', '.cmd'],
        scanForMalware: false,
      };
    }
  }

  async validate(input: DocumentValidationInput): Promise<DocumentValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate content type
    if (!this.isValidContentType(input.contentType)) {
      errors.push(`Content type '${input.contentType}' is not allowed`);
    }

    // Validate file size
    if (!this.isValidSize(input.size, input.contentType)) {
      errors.push(`File size ${this.formatBytes(input.size)} exceeds maximum allowed size`);
    }

    if (this.config?.minFileSize && input.size < this.config.minFileSize) {
      errors.push(`File size ${this.formatBytes(input.size)} is below minimum required size`);
    }

    // Validate file extension
    const extension = this.getFileExtension(input.fileName).toLowerCase();
    
    if (this.config?.blockedExtensions?.includes(extension)) {
      errors.push(`File extension '${extension}' is blocked for security reasons`);
    }

    if (this.config?.allowedExtensions && this.config.allowedExtensions.length > 0 && !this.config.allowedExtensions.includes(extension)) {
      warnings.push(`File extension '${extension}' is not in the allowed list`);
    }

    // Validate filename
    const sanitizedFileName = this.sanitizeFileName(input.fileName);
    if (sanitizedFileName !== input.fileName) {
      warnings.push('Filename contains special characters that will be sanitized');
    }

    // Content validation (if buffer provided)
    if (input.buffer) {
      const contentValidation = await this.validateFileContent(input.buffer, input.contentType);
      errors.push(...contentValidation.errors);
      warnings.push(...contentValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedFileName,
    };
  }

  isValidContentType(contentType: string): boolean {
    return this.config.allowedContentTypes.includes(contentType);
  }

  isValidSize(size: number, contentType: string): boolean {
    // Different size limits for different content types
    let maxSize = this.config.maxFileSize;

    if (contentType.startsWith('image/')) {
      maxSize = Math.min(maxSize, 10 * 1024 * 1024); // 10MB for images
    } else if (contentType === 'application/pdf') {
      maxSize = Math.min(maxSize, 25 * 1024 * 1024); // 25MB for PDFs
    }

    return size <= maxSize;
  }

  private async validateFileContent(
    buffer: Buffer,
    expectedContentType: string,
  ): Promise<{ errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic file signature validation
    const actualContentType = this.detectContentTypeFromBuffer(buffer);
    
    if (actualContentType && actualContentType !== expectedContentType) {
      warnings.push(
        `File content type mismatch: expected '${expectedContentType}', detected '${actualContentType}'`,
      );
    }

    // Malware scanning (if enabled)
    if (this.config.scanForMalware) {
      const isSafe = await this.scanForMalware(buffer);
      if (!isSafe) {
        errors.push('File failed malware scan');
      }
    }

    return { errors, warnings };
  }

  private detectContentTypeFromBuffer(buffer: Buffer): string | null {
    // Basic file signature detection
    const signatures: { [key: string]: string } = {
      'ffd8ff': 'image/jpeg',
      '89504e47': 'image/png',
      '47494638': 'image/gif',
      '25504446': 'application/pdf',
      '504b0304': 'application/zip',
      'd0cf11e0': 'application/msword',
    };

    const header = buffer.subarray(0, 4).toString('hex');
    
    for (const [signature, contentType] of Object.entries(signatures)) {
      if (header.startsWith(signature)) {
        return contentType;
      }
    }

    return null;
  }

  private async scanForMalware(buffer: Buffer): Promise<boolean> {
    // Placeholder for malware scanning
    // In production, integrate with services like ClamAV, VirusTotal, etc.
    return true;
  }

  private getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot !== -1 ? fileName.substring(lastDot) : '';
  }

  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}