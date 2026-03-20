import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { EmailRequest, ProcessedEmailRequest, EmailAttachment } from '../interfaces/email-request.interface';
import { EmailValidatorService } from './email-validator.service';
import { EmailAttachmentService } from './email-attachment.service';

/**
 * Service responsible for processing email requests
 * Follows Single Responsibility Principle - orchestrates email processing
 */
@Injectable()
export class EmailProcessorService {
  private readonly logger = new Logger(EmailProcessorService.name);

  constructor(
    private readonly emailValidatorService: EmailValidatorService,
    private readonly emailAttachmentService: EmailAttachmentService,
  ) {}

  /**
   * Process complete email request
   * @param emailRequest Raw email request
   * @returns Processed email request ready for sending
   */
  async processEmailRequest(emailRequest: EmailRequest): Promise<ProcessedEmailRequest> {
    this.logger.debug('Processing email request', { 
      to: emailRequest.to, 
      subject: emailRequest.subject,
      attachmentCount: emailRequest.attachments?.length || 0
    });

    try {
      // Step 1: Validate the email request
      this.emailValidatorService.validateEmailRequest(emailRequest);

      // Step 2: Process attachments
      const attachments = await this.processAttachments(emailRequest);

      // Step 3: Process HTML body
      const processedBody = this.processEmailBody(emailRequest.body);

      // Step 4: Build processed email request
      const processedRequest: ProcessedEmailRequest = {
        to: emailRequest.to.trim(),
        cc: emailRequest.cc?.map(email => email.trim()).filter(Boolean),
        bcc: emailRequest.bcc?.map(email => email.trim()).filter(Boolean),
        subject: emailRequest.subject.trim(),
        html: processedBody,
        attachments,
        priority: emailRequest.priority || 'normal',
        metadata: {
          ...emailRequest.metadata,
          processedAt: new Date().toISOString(),
          attachmentCount: attachments.length
        }
      };

      this.logger.debug('Email request processed successfully', {
        to: processedRequest.to,
        attachmentCount: processedRequest.attachments.length
      });

      return processedRequest;

    } catch (error) {
      this.logger.error('Failed to process email request:', error);
      throw error;
    }
  }

  /**
   * Process email attachments including LOI key
   * @param emailRequest Email request containing attachment info
   * @returns Array of processed attachments
   */
  private async processAttachments(emailRequest: EmailRequest): Promise<EmailAttachment[]> {
    const attachmentKeys: string[] = [];

    // Add regular attachments
    if (emailRequest.attachments && emailRequest.attachments.length > 0) {
      attachmentKeys.push(...emailRequest.attachments);
    }

    // Add LOI key if provided
    if (emailRequest.Key) {
      attachmentKeys.push(emailRequest.Key);
    }

    if (attachmentKeys.length === 0) {
      return [];
    }

    return await this.emailAttachmentService.processAttachments(attachmentKeys);
  }

  /**
   * Process and sanitize email body HTML
   * @param body Raw HTML body
   * @returns Processed HTML body
   */
  private processEmailBody(body: string): string {
    let processedBody = body.trim();

    // Add basic HTML structure if not present
    if (!processedBody.toLowerCase().includes('<html')) {
      processedBody = this.wrapInHtmlStructure(processedBody);
    }

    // Add email-specific CSS for better rendering
    processedBody = this.addEmailStyles(processedBody);

    return processedBody;
  }

  /**
   * Wrap content in basic HTML structure
   * @param content HTML content
   * @returns Complete HTML document
   */
  private wrapInHtmlStructure(content: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email</title>
</head>
<body>
    ${content}
</body>
</html>`.trim();
  }

  /**
   * Add email-friendly CSS styles
   * @param html HTML content
   * @returns HTML with added styles
   */
  private addEmailStyles(html: string): string {
    const emailStyles = `
<style>
    body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
    }
    .email-header {
        border-bottom: 2px solid #007bff;
        padding-bottom: 10px;
        margin-bottom: 20px;
    }
    .email-footer {
        border-top: 1px solid #ddd;
        padding-top: 20px;
        margin-top: 30px;
        font-size: 12px;
        color: #666;
    }
    table {
        border-collapse: collapse;
        width: 100%;
    }
    th, td {
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
    }
    th {
        background-color: #f2f2f2;
    }
    .button {
        display: inline-block;
        padding: 10px 20px;
        background-color: #007bff;
        color: white;
        text-decoration: none;
        border-radius: 4px;
        margin: 10px 0;
    }
    .highlight {
        background-color: #fff3cd;
        padding: 10px;
        border-left: 4px solid #ffc107;
        margin: 10px 0;
    }
</style>`;

    // Insert styles after <head> tag or at the beginning if no head tag
    if (html.toLowerCase().includes('<head>')) {
      return html.replace(/<head>/i, `<head>${emailStyles}`);
    } else if (html.toLowerCase().includes('<html>')) {
      return html.replace(/<html[^>]*>/i, `$&<head>${emailStyles}</head>`);
    } else {
      return `${emailStyles}${html}`;
    }
  }
}