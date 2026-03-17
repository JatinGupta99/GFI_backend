import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { DocuSignService } from './docusign.service';
import { SendForSignatureDto } from './dto/send-for-signature.dto';
import { EnvelopeResponseDto } from './dto/envelope-response.dto';
import { DocuSignWebhookDto } from './dto/docusign-webhook.dto';
import { GenerateSigningUrlDto } from './dto/generate-signing-url.dto';
import { SigningUrlResponseDto } from './dto/signing-url-response.dto';
import { CreateSenderViewDto, SenderViewResponseDto } from './dto/sender-view.dto';
import { LeadsRepository } from '../../leads/repository/lead.repository';
import { HmacValidationGuard } from './guards/hmac-validation.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { readFile } from 'fs/promises';
import { MediaService } from '../../media/media.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { MailService } from '../../mail/mail.service';
import { EmailType } from '../../../common/enums/common-enums';
import { UserId } from '../../../common/decorators/user-id.decorator';
import { ConfigService } from '@nestjs/config';

@Controller('leases')
export class DocuSignController {
  private readonly logger = new Logger(DocuSignController.name);

  constructor(
    private readonly docuSignService: DocuSignService,
    private readonly leadRepository: LeadsRepository,
    private readonly mediaService: MediaService,
    private readonly httpService: HttpService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Helper method to download PDF from S3 presigned URL, S3 key, or local file
   * @param pdfUrl - Presigned S3 URL, S3 URI (s3://), S3 key, or local file path
   * @returns Buffer containing the PDF data
   */
  private async downloadPdf(pdfUrl: string): Promise<Buffer> {
    try {
      // Check if it's an S3 URI (s3://bucket/key)
      if (pdfUrl.startsWith('s3://')) {
        this.logger.log(`Parsing S3 URI: ${pdfUrl}`);
        
        // Extract S3 key from s3://bucket/key format
        const s3Key = pdfUrl.replace(/^s3:\/\/[^\/]+\//, '');
        this.logger.log(`Extracted S3 key: ${s3Key}`);
        
        // Generate presigned URL for S3 download (15 minutes expiry)
        const presignedUrl = await this.mediaService.generateDownloadUrl(s3Key, 900);
        
        // Download the file from S3 using the presigned URL
        const response = await firstValueFrom(
          this.httpService.get(presignedUrl, {
            responseType: 'arraybuffer',
            timeout: 30000, // 30 second timeout
            httpsAgent: new (require('https').Agent)({
              rejectUnauthorized: false, // Allow self-signed certificates
            }),
          })
        );
        
        this.logger.log(`Successfully downloaded PDF from S3 URI: ${pdfUrl}`);
        return Buffer.from(response.data);
      }
      
      // Check if it's already a presigned URL (contains amazonaws.com)
      if (pdfUrl.includes('amazonaws.com') || pdfUrl.startsWith('http://') || pdfUrl.startsWith('https://')) {
        this.logger.log(`Downloading PDF from URL: ${pdfUrl.substring(0, 100)}...`);
        
        // Configure HTTP client with SSL options for external URLs
        const httpConfig: any = {
          responseType: 'arraybuffer',
          timeout: 30000, // 30 second timeout
          maxRedirects: 5,
          validateStatus: (status: number) => status >= 200 && status < 300,
        };

        // Add HTTPS agent for SSL certificate handling
        if (pdfUrl.startsWith('https://')) {
          httpConfig.httpsAgent = new (require('https').Agent)({
            rejectUnauthorized: false, // Allow self-signed certificates
            timeout: 30000,
          });
        }
        
        // Download directly from the URL with retry logic
        let lastError: any;
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            this.logger.debug(`Download attempt ${attempt}/${maxRetries} for URL: ${pdfUrl.substring(0, 100)}...`);
            
            const response = await firstValueFrom(
              this.httpService.get(pdfUrl, httpConfig)
            );
            
            // Validate response
            if (!response.data || response.data.byteLength === 0) {
              throw new Error('Downloaded PDF is empty');
            }
            
            this.logger.log(`Successfully downloaded PDF from URL (${response.data.byteLength} bytes)`);
            return Buffer.from(response.data);
            
          } catch (error) {
            lastError = error;
            this.logger.warn(`Download attempt ${attempt} failed: ${error.message}`);
            
            if (attempt < maxRetries) {
              // Wait before retry (exponential backoff)
              const delay = Math.pow(2, attempt) * 1000;
              this.logger.debug(`Retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        // All retries failed
        throw new Error(`Failed to download PDF after ${maxRetries} attempts. Last error: ${lastError.message}`);
      }
      
      // Check if it's an S3 key (doesn't start with / or C:\ etc.)
      const isS3Key = !pdfUrl.startsWith('/') && !pdfUrl.match(/^[A-Za-z]:\\/);

      if (isS3Key) {
        this.logger.log(`Generating presigned URL for S3 key: ${pdfUrl}`);
        
        // Generate presigned URL for S3 download (15 minutes expiry)
        const presignedUrl = await this.mediaService.generateDownloadUrl(pdfUrl, 900);
        
        // Download the file from S3 using the presigned URL
        const response = await firstValueFrom(
          this.httpService.get(presignedUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            httpsAgent: new (require('https').Agent)({
              rejectUnauthorized: false,
            }),
          })
        );
        
        if (!response.data || response.data.byteLength === 0) {
          throw new Error('Downloaded PDF from S3 is empty');
        }
        
        this.logger.log(`Successfully downloaded PDF from S3: ${pdfUrl} (${response.data.byteLength} bytes)`);
        return Buffer.from(response.data);
      } else {
        // Local file path
        this.logger.log(`Reading PDF from local file: ${pdfUrl}`);
        const fileBuffer = await readFile(pdfUrl);
        
        if (!fileBuffer || fileBuffer.length === 0) {
          throw new Error('Local PDF file is empty');
        }
        
        this.logger.log(`Successfully read local PDF file (${fileBuffer.length} bytes)`);
        return fileBuffer;
      }
    } catch (error) {
      this.logger.error(`Failed to download PDF from ${pdfUrl.substring(0, 100)}`, {
        error: error.message,
        stack: error.stack,
        code: error.code,
        url: pdfUrl.substring(0, 100)
      });
      throw error;
    }
  }

  /**
   * Send lease for signature via DocuSign
   * POST /leases/:id/send-for-signature
   * 
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
   */
  @Post(':id/send-for-signature')
  @HttpCode(HttpStatus.OK)
  async sendForSignature(
    @Param('id') leaseId: string,
    @Body() dto: SendForSignatureDto,
    @UserId() user:{
      userId:string;
      name:string;
      email:string;
      role:string;
    }
  ): Promise<EnvelopeResponseDto> {
    this.logger.log(`Received request to send lease ${leaseId} for signature`);

    try {
      // Validate lease ID parameter (Requirement 6.2)
      if (!leaseId || leaseId.trim() === '') {
        throw new BadRequestException('Lease ID is required');
      }

      // Retrieve lead from database (lead = lease) (Requirement 6.5)
      const lease = await this.leadRepository.findById(leaseId);
      
      if (!lease) {
        throw new NotFoundException(`Lease not found with ID ${leaseId}`);
      }

      // Retrieve main PDF document for DocuSign (from Key parameter)
      let pdfBuffer: Buffer | undefined;
      let pdfSource: string | undefined;
      
      const {Key,body}=dto;
      pdfSource=Key;
      console.log(pdfSource,'acslacslknasc')
      if (pdfSource) {
        try {
          this.logger.log(`Attempting to download main PDF from: ${pdfSource.substring(0, 100)}...`);
          pdfBuffer = await this.downloadPdf(pdfSource);
          console.log(pdfBuffer,'dnclsknclkd')
          if (!pdfBuffer || pdfBuffer.length === 0) {
            this.logger.error(`Downloaded PDF buffer is empty for lease ${leaseId}`);
            throw new BadRequestException('PDF document is empty or corrupted');
          }
          
          this.logger.log(`Main PDF document loaded successfully for lease ${leaseId} (${pdfBuffer.length} bytes)`);
        } catch (error) {
          this.logger.error(`Failed to retrieve main PDF for lease ${leaseId}`, {
            url: pdfSource,
            error: error.message,
            code: error.code,
            stack: error.stack
          });
          
          // Provide specific error messages based on error type
          if (error.code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY') {
            throw new BadRequestException(
              'Failed to download PDF: SSL certificate validation failed. Please ensure the PDF URL uses a valid SSL certificate or contact support.'
            );
          } else if (error.code === 'ENOTFOUND') {
            throw new BadRequestException(
              'Failed to download PDF: URL not found. Please verify the PDF URL is correct.'
            );
          } else if (error.code === 'ECONNREFUSED') {
            throw new BadRequestException(
              'Failed to download PDF: Connection refused. Please verify the PDF URL is accessible.'
            );
          } else if (error.message?.includes('timeout')) {
            throw new BadRequestException(
              'Failed to download PDF: Request timeout. The PDF server may be slow or unavailable.'
            );
          } else {
            throw new BadRequestException(
              `Failed to download PDF: ${error.message}. Please verify the PDF URL is valid and accessible.`
            );
          }
        }
      } else {
        this.logger.warn(`No PDF document URL found for lease ${leaseId}`);
        throw new BadRequestException(
          'PDF document URL is required to send lease for signature. Please provide Key parameter or ensure the lease has a valid pdfDocumentUrl.'
        );
      }

      // Download additional attachments from fileKey array (for email)
      const emailAttachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
      
      if (dto.fileKey && dto.fileKey.length > 0) {
        const validFileKeys = dto.fileKey.filter(key => key && key.trim() !== '');
        
        this.logger.log(`Processing ${validFileKeys.length} additional file(s) for email attachments`);
        
        for (const fileKey of validFileKeys) {
          try {
            this.logger.log(`Downloading attachment: ${fileKey.substring(0, 100)}...`);
            const fileBuffer = await this.downloadPdf(fileKey);
            
            if (fileBuffer && fileBuffer.length > 0) {
              // Extract filename from key
              const filename = fileKey.split('/').pop() || 'attachment.pdf';
              
              emailAttachments.push({
                filename,
                content: fileBuffer,
                contentType: 'application/pdf',
              });
              
              this.logger.log(`Successfully downloaded attachment: ${filename} (${fileBuffer.length} bytes)`);
            }
          } catch (error) {
            // Log error but don't fail the request - attachments are optional
            this.logger.warn(`Failed to download attachment ${fileKey}: ${error.message}`);
          }
        }
        
        this.logger.log(`Successfully downloaded ${emailAttachments.length} email attachment(s)`);
      }

      // Get tenant information from lead
      const tenantEmail = dto.recipientEmail || lease.general?.email;
      const tenantName = `${lease.general?.firstName || ''} ${lease.general?.lastName || ''}`.trim();

      if (!tenantEmail) {
        throw new BadRequestException('Tenant email is required');
      }

      // Filter out empty strings from CC array
      const ccEmails = dto.cc?.filter(email => email && email.trim() !== '') || [];
      
      // Update DTO with filtered CC emails
      const cleanedDto = {
        ...dto,
        cc: ccEmails.length > 0 ? ccEmails : undefined,
      };

      // Call DocuSignService to create and send envelope (Requirement 6.3)
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new BadRequestException(
          'PDF document is required to send lease for signature. Please ensure the lease has a valid PDF document.'
        );
      }

      const envelopeResponse = await this.docuSignService.sendLeaseForSignatureWithIntegration(
        cleanedDto,
        pdfBuffer,
        tenantEmail,
        tenantName,
      );

      // Update lead with envelope ID
      const updatedLead = await this.leadRepository.updateEnvelopeId(leaseId, envelopeResponse.envelopeId);
      
      if (!updatedLead) {
        this.logger.warn(`Failed to update lead ${leaseId} with envelope ID`);
      }

      this.logger.log(
        `Successfully sent lease ${leaseId} for signature. Envelope ID: ${envelopeResponse.envelopeId}`,
      );

      // Send custom email with signing URL (with or without attachments)
      if (envelopeResponse.signingUrl) {
        try {
          const propertyInfo = lease.general?.property || 'Property';
          const suiteInfo = lease.general?.suite || '';
          const propertyDisplay = suiteInfo ? `${propertyInfo}, Suite ${suiteInfo}` : propertyInfo;

          this.logger.log(`Sending custom email to ${tenantEmail} (${emailAttachments.length} attachment(s))`);

          // Send email with or without attachments
          await this.mailService.send(EmailType.GENERAL, {
            email: tenantEmail,
            cc: ccEmails.length > 0 ? ccEmails : undefined,
            subject: `LOI Agreement for Signature - ${propertyDisplay}`,
            body: body,
            firstName: lease.general?.firstName || '',
            attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
          });

          this.logger.log(
            `Custom signing email sent to ${tenantEmail} for lease ${leaseId} (${emailAttachments.length} attachment(s))`,
          );
        } catch (emailError) {
          // Log error but don't fail the request - envelope was created successfully
          this.logger.error(
            `Failed to send custom signing email for lease ${leaseId}`,
            emailError.message,
          );
        }
      }

      // Return envelope response with proper status code (Requirement 6.4)
      return envelopeResponse;
    } catch (error) {
      // Handle errors with appropriate status codes (Requirement 6.6)
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Failed to send lease ${leaseId} for signature`,
        error.stack,
      );

      throw new InternalServerErrorException(
        `Failed to send lease for signature: ${error.message}`,
      );
    }
  }

  /**
   * Get signed document download URL
   * GET /leases/:id/signed-document
   * 
   * Returns a presigned S3 URL to download the signed lease document
   */
  @Get(':id/signed-document')
  @HttpCode(HttpStatus.OK)
  async getSignedDocument(@Param('id') leaseId: string): Promise<{ downloadUrl: string }> {
    this.logger.log(`Received request to get signed document for lease ${leaseId}`);

    try {
      // Validate lease ID parameter
      if (!leaseId || leaseId.trim() === '') {
        throw new BadRequestException('Lease ID is required');
      }

      // Get presigned download URL from service
      const downloadUrl = await this.docuSignService.getSignedDocumentUrl(leaseId);

      this.logger.log(`Successfully generated download URL for lease ${leaseId}`);

      return { downloadUrl };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Failed to get signed document for lease ${leaseId}`,
        error.stack,
      );

      throw new InternalServerErrorException(
        `Failed to get signed document: ${error.message}`,
      );
    }
  }

  /**
   * Generate DocuSign signing URL for embedded signing
   * POST /leases/:id/generate-signing-url
   * 
   * Creates an envelope and returns a signing URL that the recipient can use
   * to sign the document directly (without receiving an email).
   * The URL is valid for 5 minutes.
   * 
   * Use Case: Embedded signing in your application
   */
  @Post(':id/generate-signing-url')
  @HttpCode(HttpStatus.OK)
  async generateSigningUrl(
    @Param('id') leaseId: string,
    @Body() dto: GenerateSigningUrlDto,
  ): Promise<SigningUrlResponseDto> {
    this.logger.log(`Received request to generate signing URL for lease ${leaseId}`);

    try {
      // Validate lease ID parameter
      if (!leaseId || leaseId.trim() === '') {
        throw new BadRequestException('Lease ID is required');
      }

      // Retrieve lead from database (lead = lease)
      const lease = await this.leadRepository.findById(leaseId);

      if (!lease) {
        throw new NotFoundException(`Lease not found with ID ${leaseId}`);
      }

      // Retrieve PDF document
      let pdfBuffer: Buffer;
      try {
        if (!lease.pdfDocumentUrl) {
          throw new NotFoundException('Lease PDF document not found');
        }
        
        pdfBuffer = await readFile(lease.pdfDocumentUrl);
      } catch (error) {
        this.logger.error(`Failed to retrieve PDF for lease ${leaseId}`, error);
        throw new NotFoundException('Lease PDF document not found or inaccessible');
      }

      // Generate signing URL
      const result = await this.docuSignService.sendLeaseForEmbeddedSigning(
        leaseId,
        pdfBuffer,
        dto.recipientEmail,
        dto.recipientName,
        dto.returnUrl || 'http://localhost:3000/signing-complete',
      );

      // Update lead with envelope ID
      const updatedLead = await this.leadRepository.updateEnvelopeId(leaseId, result.envelopeId);
      
      if (!updatedLead) {
        this.logger.warn(`Failed to update lead ${leaseId} with envelope ID`);
      }

      this.logger.log(
        `Successfully generated signing URL for lease ${leaseId}. Envelope ID: ${result.envelopeId}`,
      );

      // Return response
      const response: SigningUrlResponseDto = {
        signingUrl: result.signingUrl,
        envelopeId: result.envelopeId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
      };

      return response;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Failed to generate signing URL for lease ${leaseId}`,
        error.stack,
      );

      throw new InternalServerErrorException(
        `Failed to generate signing URL: ${error.message}`,
      );
    }
  }

  /**
   * Create a DocuSign sender view for drag-and-drop signature field placement.
   * POST /leases/:id/sender-view
   *
   * Returns a senderViewUrl — open this in an iframe or new tab.
   * The sender drags a "Signature" field onto the PDF, clicks Send,
   * and DocuSign delivers the envelope to the tenant automatically.
   */
  @Post(':id/sender-view')
  @HttpCode(HttpStatus.OK)
  async createSenderView(
    @Param('id') leaseId: string,
    @Body() dto: CreateSenderViewDto,
  ): Promise<SenderViewResponseDto> {
    const lease = await this.leadRepository.findById(leaseId);
    if (!lease) throw new NotFoundException(`Lease not found: ${leaseId}`);

    const pdfBuffer = await this.downloadPdf(dto.Key);
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new BadRequestException('PDF document is empty or could not be downloaded');
    }

    const recipientEmail = dto.recipientEmail || lease.general?.email;
    if (!recipientEmail) throw new BadRequestException('Recipient email is required');

    const recipientName = `${lease.general?.firstName || ''} ${lease.general?.lastName || ''}`.trim() || 'Tenant';

    const returnUrl = dto.returnUrl
      || this.configService.get<string>('DOCUSIGN_RETURN_URL')
      || 'https://www.docusign.com/deeplinkRedirect';

    const result = await this.docuSignService.createSenderView(
      leaseId,
      pdfBuffer,
      recipientEmail,
      recipientName,
      returnUrl,
    );

    // Store the draft envelope ID on the lead so webhook can match it later
    await this.leadRepository.updateEnvelopeId(leaseId, result.envelopeId);

    return result;
  }
}

/**
 * Controller for DocuSign webhook endpoints
 * Handles incoming webhook notifications from DocuSign Connect
 */
@Controller('webhooks')
export class DocuSignWebhookController {
  private readonly logger = new Logger(DocuSignWebhookController.name);

  constructor(private readonly docuSignService: DocuSignService) {}

  /**
   * Handle DocuSign webhook events
   * POST /webhooks/docusign
   * 
   * This endpoint receives webhook notifications from DocuSign Connect
   * when envelope status changes. It validates the HMAC signature and
   * processes completed envelopes.
   * 
   * Requirements: 6.7, 6.9, 7.2
   */
  @Post('docusign')
  @Public() // Exclude from authentication (Requirement 6.9)
  @UseGuards(HmacValidationGuard) // Apply HMAC validation
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: DocuSignWebhookDto): Promise<void> {
    this.logger.log(
      `Received webhook event: ${payload.event}, Envelope ID: ${payload.data.envelopeId}`,
    );

    try {
      // Process the webhook event
      await this.docuSignService.handleWebhookEvent(payload);
      
      this.logger.log(
        `Successfully processed webhook for envelope ${payload.data.envelopeId}`,
      );
    } catch (error) {
      // Log error but return 200 OK to prevent DocuSign retries
      // This implements idempotent error handling (Requirement 3.12)
      this.logger.error(
        `Error processing webhook for envelope ${payload.data.envelopeId}: ${error.message}`,
        error.stack,
      );
    }

    // Always return 200 OK to acknowledge receipt
    return;
  }
}
