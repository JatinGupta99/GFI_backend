import { Injectable, Logger } from '@nestjs/common';
import { EmailRequest } from '../interfaces/email-request.interface';
import { EmailProcessorService } from './email-processor.service';
import { EnhancedMailService } from './enhanced-mail.service';

/**
 * Main orchestrator service that coordinates the entire email sending process
 * Follows Single Responsibility Principle - orchestrates the email workflow
 * Implements Dependency Inversion Principle - depends on abstractions
 */
@Injectable()
export class EmailOrchestratorService {
  private readonly logger = new Logger(EmailOrchestratorService.name);

  constructor(
    private readonly emailProcessorService: EmailProcessorService,
    private readonly enhancedMailService: EnhancedMailService,
  ) {}

  /**
   * Send email with full processing pipeline
   * @param emailRequest Raw email request
   * @returns Email sending result with metadata
   */
  async sendEmail(emailRequest: EmailRequest): Promise<{
    success: boolean;
    messageId?: string;
    sentAt: string;
    metadata: Record<string, any>;
  }> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    this.logger.log(`📧 Starting email send process [${requestId}]`, {
      requestId,
      to: emailRequest.to,
      subject: emailRequest.subject,
      attachmentCount: emailRequest.attachments?.length || 0,
      hasLoiKey: !!emailRequest.Key
    });

    try {
      // Step 1: Process the email request (validation, attachments, formatting)
      this.logger.debug(`Processing email request [${requestId}]`);
      const processedEmail = await this.emailProcessorService.processEmailRequest(emailRequest);

      // Step 2: Send the processed email
      this.logger.debug(`Sending processed email [${requestId}]`);
      const result = await this.enhancedMailService.sendProcessedEmail(processedEmail);

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      this.logger.log(`✅ Email sent successfully [${requestId}] in ${totalDuration}ms`, {
        requestId,
        messageId: result.messageId,
        to: emailRequest.to,
        totalDuration
      });

      return {
        ...result,
        metadata: {
          ...result.metadata,
          requestId,
          totalDuration,
          processedAt: processedEmail.metadata?.processedAt
        }
      };

    } catch (error) {
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      this.logger.error(`❌ Email send failed [${requestId}] after ${totalDuration}ms`, {
        requestId,
        error: error.message,
        to: emailRequest.to,
        subject: emailRequest.subject,
        totalDuration
      });

      // Re-throw with additional context
      if (error.response) {
        error.response.metadata = {
          ...error.response.metadata,
          requestId,
          totalDuration
        };
      }

      throw error;
    }
  }

  /**
   * Send multiple emails in batch (with rate limiting consideration)
   * @param emailRequests Array of email requests
   * @param options Batch processing options
   * @returns Batch processing results
   */
  async sendEmailBatch(
    emailRequests: EmailRequest[],
    options: {
      concurrency?: number;
      delayBetweenEmails?: number;
      continueOnError?: boolean;
    } = {}
  ): Promise<{
    successful: number;
    failed: number;
    results: Array<{
      success: boolean;
      email: string;
      messageId?: string;
      error?: string;
    }>;
  }> {
    const {
      concurrency = 3,
      delayBetweenEmails = 100,
      continueOnError = true
    } = options;

    this.logger.log(`📧 Starting batch email send`, {
      totalEmails: emailRequests.length,
      concurrency,
      delayBetweenEmails,
      continueOnError
    });

    const results: Array<{
      success: boolean;
      email: string;
      messageId?: string;
      error?: string;
    }> = [];

    let successful = 0;
    let failed = 0;

    // Process emails in batches with concurrency control
    for (let i = 0; i < emailRequests.length; i += concurrency) {
      const batch = emailRequests.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (emailRequest) => {
        try {
          const result = await this.sendEmail(emailRequest);
          successful++;
          return {
            success: true,
            email: emailRequest.to,
            messageId: result.messageId
          };
        } catch (error) {
          failed++;
          const errorMessage = error.response?.message || error.message || 'Unknown error';
          
          if (!continueOnError) {
            throw error;
          }
          
          return {
            success: false,
            email: emailRequest.to,
            error: errorMessage
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add delay between batches if specified
      if (delayBetweenEmails > 0 && i + concurrency < emailRequests.length) {
        await this.delay(delayBetweenEmails);
      }
    }

    this.logger.log(`📧 Batch email send completed`, {
      totalEmails: emailRequests.length,
      successful,
      failed,
      successRate: `${((successful / emailRequests.length) * 100).toFixed(1)}%`
    });

    return {
      successful,
      failed,
      results
    };
  }

  /**
   * Generate unique request ID for tracking
   * @returns Unique request ID
   */
  private generateRequestId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `email_${timestamp}_${random}`;
  }

  /**
   * Utility method to add delay
   * @param ms Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}