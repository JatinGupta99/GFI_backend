import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
  ValidationPipe,
  UsePipes
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiHeader
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { SendEmailDto } from '../dto/send-email.dto';
import { EmailOrchestratorService } from '../services/email-orchestrator.service';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';

/**
 * Email Controller following REST API best practices
 * Implements Interface Segregation Principle - focused on email operations only
 */
@ApiTags('Email')
@Controller('email')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EmailController {
  private readonly logger = new Logger(EmailController.name);

  constructor(
    private readonly emailOrchestratorService: EmailOrchestratorService,
  ) {}

  /**
   * Send a single email with attachments and LOI support
   */
  @Post('send')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ResponseMessage('Email sent successfully')
  @ApiOperation({
    summary: 'Send Email',
    description: 'Send an email with optional attachments and LOI document. Supports CC/BCC recipients and priority levels.'
  })
  @ApiBody({
    type: SendEmailDto,
    description: 'Email details including recipients, content, and attachments',
    examples: {
      'LOI Email': {
        summary: 'Letter of Intent Email',
        description: 'Example of sending an LOI email with attachments',
        value: {
          to: 'tenant@example.com',
          cc: ['manager@company.com', 'legal@company.com'],
          subject: 'LOI for Suite 100 at Property Name',
          body: '<div><h2>Letter of Intent</h2><p>Please find attached the Letter of Intent for Suite 100.</p><p>Best regards,<br>Property Management Team</p></div>',
          attachments: ['attachment-id-1', 'attachment-id-2'],
          loiKey: 'documents/lead-69a49bcc4a4f3730af4d3b58/loi-pdf-s3-key',
          priority: 'high',
          metadata: {
            leadId: '69a49bcc4a4f3730af4d3b58',
            propertyId: 'prop-123',
            templateId: 'loi-template'
          }
        }
      },
      'Simple Email': {
        summary: 'Simple Email',
        description: 'Basic email without attachments',
        value: {
          to: 'user@example.com',
          subject: 'Welcome to Our Platform',
          body: '<div><h1>Welcome!</h1><p>Thank you for joining our platform.</p></div>',
          priority: 'normal'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Email sent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Email sent successfully' },
        data: {
          type: 'object',
          properties: {
            messageId: { type: 'string', example: '<20240101120000.1234@smtp.example.com>' },
            sentAt: { type: 'string', format: 'date-time', example: '2024-01-01T12:00:00.000Z' },
            metadata: {
              type: 'object',
              properties: {
                requestId: { type: 'string', example: 'email_1704110400000_abc123' },
                duration: { type: 'number', example: 1250 },
                recipientCount: { type: 'number', example: 3 },
                attachmentCount: { type: 'number', example: 2 }
              }
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid email data',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Invalid email format for recipient' },
        error: { type: 'string', example: 'BAD_REQUEST' }
      }
    }
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error - Email sending failed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Failed to send email' },
        error: { type: 'string', example: 'INTERNAL_SERVER_ERROR' },
        details: {
          type: 'object',
          properties: {
            type: { type: 'string', example: 'SMTP_ERROR' },
            description: { type: 'string', example: 'SMTP server connection failed' },
            suggestion: { type: 'string', example: 'Check SMTP configuration' }
          }
        }
      }
    }
  })
  @ApiHeader({
    name: 'Authorization',
    description: 'Bearer JWT token',
    required: true,
    schema: { type: 'string', example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
  })
  async sendEmail(@Body() sendEmailDto: SendEmailDto) {
    this.logger.log('📧 Email send request received', {
      to: sendEmailDto.to,
      subject: sendEmailDto.subject,
      ccCount: sendEmailDto.cc?.length || 0,
      bccCount: sendEmailDto.bcc?.length || 0,
      attachmentCount: sendEmailDto.attachments?.length || 0,
      hasLoiKey: !!sendEmailDto.Key,
      priority: sendEmailDto.priority || 'normal'
    });

    try {
      const result = await this.emailOrchestratorService.sendEmail({
        to: sendEmailDto.to,
        cc: sendEmailDto.cc,
        bcc: sendEmailDto.bcc,
        subject: sendEmailDto.subject,
        body: sendEmailDto.body,
        attachments: sendEmailDto.attachments,
        Key: sendEmailDto.Key,
        priority: sendEmailDto.priority,
        metadata: sendEmailDto.metadata
      });

      this.logger.log('✅ Email sent successfully', {
        to: sendEmailDto.to,
        messageId: result.messageId,
        requestId: result.metadata.requestId
      });

      return {
        success: true,
        message: 'Email sent successfully',
        data: {
          messageId: result.messageId,
          sentAt: result.sentAt,
          metadata: {
            requestId: result.metadata.requestId,
            duration: result.metadata.totalDuration,
            recipientCount: result.metadata.recipientCount,
            attachmentCount: result.metadata.attachmentCount
          }
        }
      };

    } catch (error) {
      this.logger.error('❌ Email send failed', {
        to: sendEmailDto.to,
        subject: sendEmailDto.subject,
        error: error.message,
        requestId: error.response?.metadata?.requestId
      });

      // The error is already properly formatted by the service layer
      throw error;
    }
  }

  /**
   * Send multiple emails in batch
   */
  @Post('send-batch')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ResponseMessage('Batch email processing completed')
  @ApiOperation({
    summary: 'Send Batch Emails',
    description: 'Send multiple emails in batch with concurrency control and error handling'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        emails: {
          type: 'array',
          items: { $ref: '#/components/schemas/SendEmailDto' },
          description: 'Array of email requests'
        },
        options: {
          type: 'object',
          properties: {
            concurrency: { type: 'number', default: 3, description: 'Number of concurrent emails to send' },
            delayBetweenEmails: { type: 'number', default: 100, description: 'Delay in milliseconds between email batches' },
            continueOnError: { type: 'boolean', default: true, description: 'Continue processing if individual emails fail' }
          }
        }
      },
      required: ['emails']
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Batch processing completed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Batch email processing completed' },
        data: {
          type: 'object',
          properties: {
            successful: { type: 'number', example: 8 },
            failed: { type: 'number', example: 2 },
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  email: { type: 'string' },
                  messageId: { type: 'string' },
                  error: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  })
  async sendEmailBatch(@Body() batchRequest: {
    emails: SendEmailDto[];
    options?: {
      concurrency?: number;
      delayBetweenEmails?: number;
      continueOnError?: boolean;
    };
  }) {
    this.logger.log('📧 Batch email send request received', {
      emailCount: batchRequest.emails.length,
      options: batchRequest.options
    });

    const emailRequests = batchRequest.emails.map(dto => ({
      to: dto.to,
      cc: dto.cc,
      bcc: dto.bcc,
      subject: dto.subject,
      body: dto.body,
      attachments: dto.attachments,
      loiKey: dto.Key,
      priority: dto.priority,
      metadata: dto.metadata
    }));

    const result = await this.emailOrchestratorService.sendEmailBatch(
      emailRequests,
      batchRequest.options
    );

    this.logger.log('✅ Batch email processing completed', {
      totalEmails: batchRequest.emails.length,
      successful: result.successful,
      failed: result.failed
    });

    return {
      success: true,
      message: 'Batch email processing completed',
      data: result
    };
  }
}