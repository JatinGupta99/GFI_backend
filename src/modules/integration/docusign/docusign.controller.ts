import {
  Controller,
  Post,
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
import { LeaseRepository } from '../../leasing/repository/lease.repository';
import { HmacValidationGuard } from './guards/hmac-validation.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { readFile } from 'fs/promises';
import { join } from 'path';

@Controller('leases')
export class DocuSignController {
  private readonly logger = new Logger(DocuSignController.name);

  constructor(
    private readonly docuSignService: DocuSignService,
    private readonly leaseRepository: LeaseRepository,
  ) {}

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

      // Retrieve lease from database (Requirement 6.5)
      let lease;
      try {
        lease = await this.leaseRepository.findById(leaseId);
      } catch (error) {
        if (error instanceof NotFoundException || error instanceof BadRequestException) {
          throw new NotFoundException(`Lease with ID ${leaseId} not found`);
        }
        throw error;
      }

      // Retrieve PDF document (Requirement 6.3)
      let pdfBuffer: Buffer;
      try {
        if (!lease.pdfDocumentUrl) {
          throw new NotFoundException('Lease PDF document not found');
        }
        
        // For now, assume pdfDocumentUrl is a file path
        // In production, this might be an S3 URL or database reference
        pdfBuffer = await readFile(lease.pdfDocumentUrl);
      } catch (error) {
        this.logger.error(`Failed to retrieve PDF for lease ${leaseId}`, error);
        throw new NotFoundException('Lease PDF document not found or inaccessible');
      }

      // Get tenant information from lease
      const tenantEmail = dto.recipientEmail || lease.tenantEmail;
      const tenantName = lease.tenantName;

      if (!tenantEmail) {
        throw new BadRequestException('Tenant email is required');
      }

      // Call DocuSignService to create and send envelope (Requirement 6.3)
      const envelopeResponse = await this.docuSignService.sendLeaseForSignatureWithIntegration(
        dto,
        pdfBuffer,
        tenantEmail,
        tenantName,
      );

      // Update lease with envelope ID
      await this.leaseRepository.updateEnvelopeId(leaseId, envelopeResponse.envelopeId);

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
