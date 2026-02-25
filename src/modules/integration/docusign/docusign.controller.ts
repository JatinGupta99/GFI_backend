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
import { LeadsRepository } from '../../leads/repository/lead.repository';
import { HmacValidationGuard } from './guards/hmac-validation.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { readFile } from 'fs/promises';
import { MediaService } from '../../media/media.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Controller('leases')
export class DocuSignController {
  private readonly logger = new Logger(DocuSignController.name);

  constructor(
    private readonly docuSignService: DocuSignService,
    private readonly leadRepository: LeadsRepository,
    private readonly mediaService: MediaService,
    private readonly httpService: HttpService,
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
          })
        );
        
        this.logger.log(`Successfully downloaded PDF from S3 URI: ${pdfUrl}`);
        return Buffer.from(response.data);
      }
      
      // Check if it's already a presigned URL (contains amazonaws.com)
      if (pdfUrl.includes('amazonaws.com') || pdfUrl.startsWith('http://') || pdfUrl.startsWith('https://')) {
        this.logger.log(`Downloading PDF from URL: ${pdfUrl.substring(0, 100)}...`);
        
        // Download directly from the presigned URL
        const response = await firstValueFrom(
          this.httpService.get(pdfUrl, {
            responseType: 'arraybuffer',
          })
        );
        
        this.logger.log(`Successfully downloaded PDF from URL`);
        return Buffer.from(response.data);
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
          })
        );
        
        this.logger.log(`Successfully downloaded PDF from S3: ${pdfUrl}`);
        return Buffer.from(response.data);
      } else {
        // Local file path
        this.logger.log(`Reading PDF from local file: ${pdfUrl}`);
        return await readFile(pdfUrl);
      }
    } catch (error) {
      this.logger.error(`Failed to download PDF from ${pdfUrl.substring(0, 100)}`, error);
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

      // Retrieve PDF document (optional - supports presigned URL, S3 key, or local file path)
      let pdfBuffer: Buffer | undefined;
      
      // Use local test file if isTesting flag is true
      if (dto.isTesting === true) {
        lease.pdfDocumentUrl = 'Mathnasium Southlake - LOI. 2.12.2021.pdf';
        this.logger.log(`Testing mode enabled - using local file: ${lease.pdfDocumentUrl}`);
      }
      
      if (lease.pdfDocumentUrl) {
        try {
          pdfBuffer = await this.downloadPdf(lease.pdfDocumentUrl);
          this.logger.log(`PDF document loaded for lease ${leaseId}`);
        } catch (error) {
          this.logger.warn(`Failed to retrieve PDF for lease ${leaseId}, continuing without it`, error);
          // Continue without PDF - it's optional
        }
      } else {
        this.logger.warn(`No PDF document URL found for lease ${leaseId}, continuing without it`);
      }

      // Get tenant information from lead
      const tenantEmail = dto.recipientEmail || lease.general?.email;
      const tenantName = `${lease.general?.firstName || ''} ${lease.general?.lastName || ''}`.trim();

      if (!tenantEmail) {
        throw new BadRequestException('Tenant email is required');
      }

      // Call DocuSignService to create and send envelope (Requirement 6.3)
      const envelopeResponse = await this.docuSignService.sendLeaseForSignatureWithIntegration(
        dto,
        pdfBuffer || Buffer.from(''), // Empty buffer if no PDF
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
