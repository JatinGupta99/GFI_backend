import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ProcessedEmailRequest } from '../interfaces/email-request.interface';

/**
 * Enhanced mail service for sending processed emails
 * Follows Single Responsibility Principle - only handles email sending
 */
@Injectable()
export class EnhancedMailService {
  private readonly logger = new Logger(EnhancedMailService.name);

  constructor(private readonly mailerService: MailerService) {}

  /**
   * Send processed email
   * @param processedEmail Processed email request
   * @returns Success status and metadata
   */
  async sendProcessedEmail(processedEmail: ProcessedEmailRequest): Promise<{
    success: boolean;
    messageId?: string;
    sentAt: string;
    metadata: Record<string, any>;
  }> {
    const startTime = Date.now();
    
    this.logger.debug('Sending processed email', {
      to: processedEmail.to,
      cc: processedEmail.cc?.length || 0,
      bcc: processedEmail.bcc?.length || 0,
      subject: processedEmail.subject,
      attachmentCount: processedEmail.attachments.length,
      priority: processedEmail.priority
    });

    try {
      // Prepare email options for mailer
      const emailOptions = this.buildEmailOptions(processedEmail);

      // Send email
      const result = await this.mailerService.sendMail(emailOptions);

      const endTime = Date.now();
      const duration = endTime - startTime;

      this.logger.log(`✅ Email sent successfully to ${processedEmail.to} in ${duration}ms`, {
        messageId: result.messageId,
        to: processedEmail.to,
        subject: processedEmail.subject,
        duration
      });

      return {
        success: true,
        messageId: result.messageId,
        sentAt: new Date().toISOString(),
        metadata: {
          ...processedEmail.metadata,
          duration,
          messageId: result.messageId,
          recipientCount: this.countRecipients(processedEmail),
          attachmentCount: processedEmail.attachments.length
        }
      };

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      this.logger.error(`❌ Failed to send email to ${processedEmail.to}`, {
        error: error.message,
        stack: error.stack,
        duration,
        to: processedEmail.to,
        subject: processedEmail.subject
      });

      // Enhanced error handling
      const errorDetails = this.analyzeEmailError(error);
      
      throw new InternalServerErrorException({
        message: 'Failed to send email',
        details: errorDetails,
        metadata: {
          ...processedEmail.metadata,
          duration,
          error: error.message,
          errorType: errorDetails.type
        }
      });
    }
  }

  /**
   * Build email options for the mailer service
   * @param processedEmail Processed email request
   * @returns Email options for mailer
   */
  private buildEmailOptions(processedEmail: ProcessedEmailRequest): any {
    const options: any = {
      to: processedEmail.to,
      subject: processedEmail.subject,
      html: processedEmail.html,
    };

    // Add CC recipients if present
    if (processedEmail.cc && processedEmail.cc.length > 0) {
      options.cc = processedEmail.cc;
    }

    // Add BCC recipients if present
    if (processedEmail.bcc && processedEmail.bcc.length > 0) {
      options.bcc = processedEmail.bcc;
    }

    // Add attachments if present
    if (processedEmail.attachments && processedEmail.attachments.length > 0) {
      options.attachments = processedEmail.attachments.map(attachment => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
        cid: attachment.cid
      }));
    }

    // Add priority headers
    if (processedEmail.priority && processedEmail.priority !== 'normal') {
      options.priority = processedEmail.priority;
      
      // Add X-Priority header for better client support
      if (!options.headers) {
        options.headers = {};
      }
      
      const priorityMap = {
        'high': '1 (Highest)',
        'low': '5 (Lowest)'
      };
      
      options.headers['X-Priority'] = priorityMap[processedEmail.priority];
    }

    return options;
  }

  /**
   * Count total recipients
   * @param processedEmail Processed email request
   * @returns Total recipient count
   */
  private countRecipients(processedEmail: ProcessedEmailRequest): number {
    let count = 1; // Primary recipient
    
    if (processedEmail.cc) {
      count += processedEmail.cc.length;
    }
    
    if (processedEmail.bcc) {
      count += processedEmail.bcc.length;
    }
    
    return count;
  }

  /**
   * Analyze email sending error for better error reporting
   * @param error Error object
   * @returns Analyzed error details
   */
  private analyzeEmailError(error: any): { type: string; description: string; suggestion: string } {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code;

    // SMTP Authentication errors
    if (errorMessage.includes('authentication') || errorCode === 'EAUTH') {
      return {
        type: 'AUTHENTICATION_ERROR',
        description: 'SMTP authentication failed',
        suggestion: 'Check SMTP credentials and server configuration'
      };
    }

    // Connection errors
    if (errorMessage.includes('connection') || errorCode === 'ECONNECTION') {
      return {
        type: 'CONNECTION_ERROR',
        description: 'Failed to connect to SMTP server',
        suggestion: 'Check SMTP server address, port, and network connectivity'
      };
    }

    // Recipient errors
    if (errorMessage.includes('recipient') || errorMessage.includes('mailbox')) {
      return {
        type: 'RECIPIENT_ERROR',
        description: 'Invalid or unreachable recipient',
        suggestion: 'Verify recipient email addresses are valid and active'
      };
    }

    // Attachment size errors
    if (errorMessage.includes('size') || errorMessage.includes('too large')) {
      return {
        type: 'SIZE_ERROR',
        description: 'Email or attachment size exceeds limits',
        suggestion: 'Reduce attachment sizes or split into multiple emails'
      };
    }

    // Rate limiting
    if (errorMessage.includes('rate') || errorMessage.includes('limit')) {
      return {
        type: 'RATE_LIMIT_ERROR',
        description: 'Email sending rate limit exceeded',
        suggestion: 'Implement email queuing or reduce sending frequency'
      };
    }

    // Generic error
    return {
      type: 'UNKNOWN_ERROR',
      description: 'Unknown email sending error',
      suggestion: 'Check email service configuration and logs'
    };
  }
}