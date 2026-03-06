import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { MediaService } from '../../media/media.service';
import { EmailAttachment } from '../interfaces/email-request.interface';

/**
 * Service responsible for processing email attachments
 * Follows Single Responsibility Principle - only handles attachment processing
 */
@Injectable()
export class EmailAttachmentService {
  private readonly logger = new Logger(EmailAttachmentService.name);

  constructor(private readonly mediaService: MediaService) {}

  /**
   * Process attachment IDs/keys and convert them to email attachments
   * @param attachmentKeys Array of S3 keys or attachment IDs
   * @returns Array of processed email attachments
   */
  async processAttachments(attachmentKeys: string[]): Promise<EmailAttachment[]> {
    if (!attachmentKeys || attachmentKeys.length === 0) {
      return [];
    }

    this.logger.debug(`Processing ${attachmentKeys.length} attachments`);

    const attachments: EmailAttachment[] = [];
    const processingPromises = attachmentKeys.map(key => this.processAttachment(key));

    try {
      const results = await Promise.allSettled(processingPromises);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          attachments.push(result.value);
        } else if (result.status === 'rejected') {
          this.logger.warn(`Failed to process attachment ${attachmentKeys[index]}: ${result.reason}`);
        } else {
          this.logger.warn(`Failed to process attachment ${attachmentKeys[index]}: No attachment returned`);
        }
      });

      this.logger.debug(`Successfully processed ${attachments.length}/${attachmentKeys.length} attachments`);
      return attachments;

    } catch (error) {
      this.logger.error('Error processing attachments:', error);
      throw new InternalServerErrorException('Failed to process email attachments');
    }
  }

  /**
   * Process a single attachment
   * @param key S3 key or attachment ID
   * @returns Processed email attachment or null if failed
   */
  private async processAttachment(key: string): Promise<EmailAttachment | null> {
    try {
      this.validateAttachmentKey(key);

      const buffer = await this.mediaService.getFileBuffer(key);
      const filename = this.extractFilename(key);
      const contentType = this.determineContentType(filename);

      return {
        filename,
        content: buffer,
        contentType,
        cid: this.generateContentId(filename)
      };

    } catch (error) {
      this.logger.error(`Failed to process attachment ${key}:`, error);
      return null;
    }
  }

  /**
   * Validate attachment key format
   * @param key Attachment key to validate
   */
  private validateAttachmentKey(key: string): void {
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      throw new BadRequestException('Invalid attachment key');
    }

    // Basic validation for S3 key format
    if (key.includes('..') || key.startsWith('/') || key.includes('//')) {
      throw new BadRequestException('Invalid attachment key format');
    }
  }

  /**
   * Extract filename from S3 key
   * @param key S3 key
   * @returns Extracted filename
   */
  private extractFilename(key: string): string {
    const parts = key.split('/');
    const filename = parts[parts.length - 1];
    
    // If no filename found, generate one
    if (!filename || filename.length === 0) {
      const extension = this.getExtensionFromKey(key);
      return `attachment_${Date.now()}${extension}`;
    }

    return filename;
  }

  /**
   * Get file extension from S3 key
   * @param key S3 key
   * @returns File extension with dot
   */
  private getExtensionFromKey(key: string): string {
    const match = key.match(/\.([^.]+)$/);
    return match ? `.${match[1]}` : '.bin';
  }

  /**
   * Determine content type based on filename
   * @param filename File name
   * @returns MIME content type
   */
  private determineContentType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'txt': 'text/plain',
      'html': 'text/html',
      'zip': 'application/zip'
    };

    return mimeTypes[extension || ''] || 'application/octet-stream';
  }

  /**
   * Generate content ID for inline attachments
   * @param filename File name
   * @returns Content ID
   */
  private generateContentId(filename: string): string {
    const timestamp = Date.now();
    const cleanFilename = filename.replace(/[^a-zA-Z0-9]/g, '');
    return `${cleanFilename}_${timestamp}@email.attachment`;
  }
}