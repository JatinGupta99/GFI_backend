import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { EnvelopeDefinition } from './interfaces/envelope-definition.interface';
import { EnvelopeResponseDto } from './dto/envelope-response.dto';
import { SendForSignatureDto } from './dto/send-for-signature.dto';
import { DocuSignWebhookDto } from './dto/docusign-webhook.dto';
import { LeadsRepository } from '../../leads/repository/lead.repository';
import { MediaService } from '../../media/media.service';

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

@Injectable()
export class DocuSignService {
  private readonly logger = new Logger(DocuSignService.name);
  private tokenCache: TokenCache | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly leadsRepository: LeadsRepository,
    private readonly mediaService: MediaService,
  ) {}

  /**
   * Send lease for signature - High-level method that integrates with leasing module
   * This method retrieves lease data and PDF, then creates and sends the envelope
   * 
   * @param dto - Send for signature request data
   * @param leasePdfBuffer - PDF buffer of the lease document
   * @param tenantEmail - Tenant email address (from lease data or override)
   * @param tenantName - Tenant name (from lease data)
   * @returns Envelope response with envelope ID and status
   * 
   * Note: Envelope ID storage in Lease entity will be implemented in Task 5
   */
  async sendLeaseForSignatureWithIntegration(
    dto: SendForSignatureDto,
    leasePdfBuffer: Buffer,
    tenantEmail: string,
    tenantName: string,
  ): Promise<EnvelopeResponseDto> {
    const { leaseId, recipientEmail, signaturePosition } = dto;

    // Use override email if provided, otherwise use tenant email from lease data
    const finalRecipientEmail = recipientEmail || tenantEmail;

    if (!finalRecipientEmail) {
      this.logger.error(`No recipient email available for lease ${leaseId}`);
      throw new Error('Recipient email is required to send lease for signature');
    }

    if (!leasePdfBuffer || leasePdfBuffer.length === 0) {
      this.logger.error(`PDF buffer is empty for lease ${leaseId}`);
      throw new Error('Lease PDF is required to send for signature');
    }

    // Call the core envelope creation method
    const envelopeResponse = await this.sendLeaseForSignature(
      leaseId,
      leasePdfBuffer,
      finalRecipientEmail,
      tenantName,
      signaturePosition,
    );

    // TODO: Store envelope ID in Lease entity (Task 5)
    // This will be implemented when the Lease entity is extended with DocuSign fields
    this.logger.log(
      `Envelope ${envelopeResponse.envelopeId} created for lease ${leaseId}. ` +
      `Envelope ID storage will be implemented in Task 5.`,
    );

    return envelopeResponse;
  }

  /**
   * Get access token with caching
   * Reuses cached token if valid (expiration > 5 minutes)
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds

    // Check if cached token exists and is still valid
    if (this.tokenCache && this.tokenCache.expiresAt - bufferTime > now) {
      this.logger.debug('Reusing cached access token');
      return this.tokenCache.accessToken;
    }

    // Generate new token
    this.logger.debug('Generating new access token');
    const jwtAssertion = this.generateJwtAssertion();
    const basePath = this.configService.get<string>('DOCUSIGN_BASE_PATH')!;

    // Determine OAuth host based on environment
    const isDemo = basePath.includes('demo');
    const oauthHost = isDemo ? 'https://account-d.docusign.com' : 'https://account.docusign.com';

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${oauthHost}/oauth/token`,
          new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwtAssertion,
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );

      const { access_token, expires_in } = response.data;
      const expiresAt = now + expires_in * 1000;

      // Cache the token
      this.tokenCache = {
        accessToken: access_token,
        expiresAt,
      };

      this.logger.log('Successfully obtained access token');
      return access_token;
    } catch (error) {
      this.logger.error(
        'Authentication failed',
        error.response?.data || error.message,
      );
      throw new Error(
        `DocuSign authentication failed: ${error.response?.data?.error || error.message}`,
      );
    }
  }

  /**
   * Generate JWT assertion for DocuSign OAuth
   * Uses RS256 algorithm with private key
   */
  private generateJwtAssertion(): string {
    const integrationKey = this.configService.get<string>(
      'DOCUSIGN_INTEGRATION_KEY',
    )!;
    const userId = this.configService.get<string>('DOCUSIGN_USER_ID')!;
    const privateKey = this.configService.get<string>('DOCUSIGN_PRIVATE_KEY')!;
    const basePath = this.configService.get<string>('DOCUSIGN_BASE_PATH')!;

    // Extract the OAuth host from basePath
    // e.g., https://demo.docusign.net/restapi -> account-d.docusign.com
    const isDemo = basePath.includes('demo');
    const oauthHost = isDemo ? 'account-d.docusign.com' : 'account.docusign.com';

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600; // 1 hour expiration

    // Create JWT header
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    // Create JWT payload
    const payload = {
      iss: integrationKey,
      sub: userId,
      aud: oauthHost,
      iat: now,
      exp: exp,
      scope: 'signature impersonation',
    };

    // Encode header and payload
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));

    // Create signature
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto
      .createSign('RSA-SHA256')
      .update(signatureInput)
      .sign(privateKey, 'base64');

    const encodedSignature = this.base64UrlEncode(
      Buffer.from(signature, 'base64'),
    );

    // Return complete JWT
    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  }

  /**
   * Base64 URL encode helper
   */
  private base64UrlEncode(input: string | Buffer): string {
    const buffer = typeof input === 'string' ? Buffer.from(input) : input;
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Send lease for signature via DocuSign
   * Creates an envelope with the lease PDF and sends it to the tenant
   */
  async sendLeaseForSignature(
    leaseId: string,
    leasePdfBuffer: Buffer,
    tenantEmail: string,
    tenantName: string,
    signaturePosition?: { pageNumber: number; xPosition: number; yPosition: number },
  ): Promise<EnvelopeResponseDto> {
    try {
      this.logger.log(`Sending lease ${leaseId} for signature to ${tenantEmail}`);

      // Encode PDF to base64
      const pdfBase64 = leasePdfBuffer.toString('base64');

      // Build envelope definition
      const envelopeDefinition = this.buildEnvelopeDefinition(
        leaseId,
        pdfBase64,
        tenantEmail,
        tenantName,
        signaturePosition,
      );

      // Get access token
      const accessToken = await this.getAccessToken();

      // Get account ID and base path
      const accountId = this.configService.get<string>('DOCUSIGN_ACCOUNT_ID')!;
      const basePath = this.configService.get<string>('DOCUSIGN_BASE_PATH')!;

      // Create envelope
      const response = await firstValueFrom(
        this.httpService.post(
          `${basePath}/v2.1/accounts/${accountId}/envelopes`,
          envelopeDefinition,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const envelopeResponse: EnvelopeResponseDto = {
        envelopeId: response.data.envelopeId,
        status: response.data.status,
        statusDateTime: response.data.statusDateTime,
        uri: response.data.uri,
      };

      this.logger.log(
        `Successfully created envelope ${envelopeResponse.envelopeId} for lease ${leaseId}`,
      );

      return envelopeResponse;
    } catch (error) {
      this.logger.error(
        `Envelope creation failed for lease ${leaseId}`,
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to send lease for signature: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  /**
   * Build envelope definition from lease data
   * Configures document, recipients, and signature tabs
   * 
   * Enhancement 4: Optional envelope expiration
   * Configure via DOCUSIGN_ENVELOPE_EXPIRE_DAYS environment variable
   */
  private buildEnvelopeDefinition(
    leaseId: string,
    pdfBase64: string,
    tenantEmail: string,
    tenantName: string,
    signaturePosition?: { pageNumber: number; xPosition: number; yPosition: number },
  ): EnvelopeDefinition {
    // Default signature position if not provided
    const sigPosition = signaturePosition || {
      pageNumber: 1,
      xPosition: 100,
      yPosition: 200,
    };

    // Enhancement 4: Optional envelope expiration
    // Get expiration days from environment (default: 30 days)
    const expireDays = this.configService.get<string>('DOCUSIGN_ENVELOPE_EXPIRE_DAYS') || '30';
    const expireEnabled = this.configService.get<string>('DOCUSIGN_ENVELOPE_EXPIRE_ENABLED') === 'true';

    const envelopeDefinition: EnvelopeDefinition = {
      emailSubject: `Please sign your lease agreement - ${leaseId}`,
      documents: [
        {
          documentBase64: pdfBase64,
          name: `Lease_${leaseId}.pdf`,
          fileExtension: 'pdf',
          documentId: '1',
        },
      ],
      recipients: {
        signers: [
          {
            email: tenantEmail,
            name: tenantName,
            recipientId: '1',
            routingOrder: '1',
            tabs: {
              signHereTabs: [
                {
                  documentId: '1',
                  pageNumber: sigPosition.pageNumber.toString(),
                  xPosition: sigPosition.xPosition.toString(),
                  yPosition: sigPosition.yPosition.toString(),
                },
              ],
            },
          },
        ],
      },
      status: 'sent',
    };

    // Add expiration settings if enabled
    if (expireEnabled) {
      envelopeDefinition.notification = {
        useAccountDefaults: 'false',
        reminders: {
          reminderEnabled: 'true',
          reminderDelay: '2', // Send reminder after 2 days
          reminderFrequency: '3', // Then every 3 days
        },
        expirations: {
          expireEnabled: 'true',
          expireAfter: expireDays, // Expire after X days
          expireWarn: '3', // Warn 3 days before expiration
        },
      };

      this.logger.log(
        `Envelope expiration enabled: ${expireDays} days for lease ${leaseId}`,
      );
    }

    return envelopeDefinition;
  }

  /**
   * Handle webhook event from DocuSign
   * Processes envelope status changes and updates lease records
   * 
   * Requirements: 3.4, 3.5, 3.6, 3.7, 3.8, 3.9
   * 
   * Enhancements:
   * - Idempotency protection: Prevents double processing on webhook retries
   * - Status history logging: Maintains audit trail for compliance
   * - Support for multiple event types: completed, declined, voided
   */
  async handleWebhookEvent(payload: DocuSignWebhookDto): Promise<void> {
    // Parse envelope status from webhook payload (Requirement 3.4)
    const envelopeStatus = payload.data.envelopeSummary.status;
    const envelopeId = payload.data.envelopeId;
    const eventType = payload.event;

    this.logger.log(
      `Processing webhook for envelope ${envelopeId} with status: ${envelopeStatus}, event: ${eventType}`,
    );

    // Enhancement 1: Filter for relevant status events only
    // Recommended to configure in DocuSign Connect: envelope-completed, envelope-declined, envelope-voided
    const relevantStatuses = ['completed', 'declined', 'voided'];
    if (!relevantStatuses.includes(envelopeStatus)) {
      this.logger.log(
        `Ignoring webhook for envelope ${envelopeId} with status ${envelopeStatus}. ` +
        `Only processing: ${relevantStatuses.join(', ')}`,
      );
      return;
    }

    // Find lead by envelope ID (Requirement 3.6)
    const lease = await this.leadsRepository.findByEnvelopeId(envelopeId);

    // Handle missing lease gracefully (Requirement 3.7)
    if (!lease) {
      this.logger.warn(
        `No lease found for envelope ${envelopeId}. This may be a test envelope or the lease was deleted.`,
      );
      return;
    }

    this.logger.log(
      `Found lease ${lease._id} for envelope ${envelopeId}. Current status: ${lease.signatureStatus}`,
    );

    // Enhancement 2: Idempotency Protection
    // Prevents double processing if DocuSign retries webhook delivery
    if (envelopeStatus === 'completed' && lease.signatureStatus === 'SIGNED') {
      this.logger.warn(
        `Lease ${lease._id} is already SIGNED. Skipping duplicate processing for envelope ${envelopeId}. ` +
        `This is likely a webhook retry from DocuSign.`,
      );
      return;
    }

    if (envelopeStatus === 'voided' && lease.signatureStatus === 'VOIDED') {
      this.logger.warn(
        `Lease ${lease._id} is already VOIDED. Skipping duplicate processing for envelope ${envelopeId}.`,
      );
      return;
    }

    // Enhancement 3: Store Envelope Status History (Audit Trail)
    // Log status change for compliance and debugging
    await this.logEnvelopeStatusHistory(
      (lease._id as any).toString(),
      envelopeId,
      envelopeStatus,
      payload,
    );

    // Process based on envelope status
    if (envelopeStatus === 'completed') {
      await this.processCompletedEnvelope(lease, envelopeId);
    } else if (envelopeStatus === 'declined') {
      await this.processDeclinedEnvelope(lease, envelopeId);
    } else if (envelopeStatus === 'voided') {
      await this.processVoidedEnvelope(lease, envelopeId);
    }

    this.logger.log(
      `Successfully processed webhook for envelope ${envelopeId}. ` +
      `Lease ${lease._id} status updated to ${envelopeStatus.toUpperCase()}`,
    );
  }

  /**
   * Process completed envelope
   * Downloads signed document and updates lease status to SIGNED
   */
  private async processCompletedEnvelope(lease: any, envelopeId: string): Promise<void> {
    this.logger.log(`Processing completed envelope ${envelopeId} for lease ${lease._id}`);

    // Retrieve signed document from DocuSign (Requirement 3.9)
    const signedPdfBuffer = await this.getSignedDocument(envelopeId);

    // Store signed document with retry logic
    const leaseIdString = (lease._id as any).toString();
    const storageReference = await this.storeSignedDocument(
      leaseIdString,
      envelopeId,
      signedPdfBuffer,
    );

    // Update lead status to SIGNED with document reference (Requirement 3.8)
    const updatedLead = await this.leadsRepository.updateSignedDocument(
      leaseIdString,
      storageReference,
    );

    if (!updatedLead) {
      this.logger.error(`Failed to update lead ${leaseIdString} with signed document`);
      throw new Error(`Failed to update lead ${leaseIdString} with signed document`);
    }

    this.logger.log(
      `Lease ${lease._id} marked as SIGNED with document reference: ${storageReference}`,
    );
  }

  /**
   * Process declined envelope
   * Updates lease status when tenant declines to sign
   */
  private async processDeclinedEnvelope(lease: any, envelopeId: string): Promise<void> {
    this.logger.log(`Processing declined envelope ${envelopeId} for lease ${lease._id}`);

    const leaseIdString = (lease._id as any).toString();

    // Update lead status to DRAFT (tenant declined, needs to be resent)
    // Note: You may want to create a specific "DECLINED" status in your schema
    const updatedLead = await this.leadsRepository.updateSignatureStatus(leaseIdString, 'DRAFT');

    if (!updatedLead) {
      this.logger.error(`Failed to update lead ${leaseIdString} status to DRAFT`);
    }

    this.logger.log(
      `Lease ${lease._id} status reset to DRAFT after tenant declined envelope ${envelopeId}`,
    );
  }

  /**
   * Process voided envelope
   * Updates lease status when envelope is voided/cancelled
   */
  private async processVoidedEnvelope(lease: any, envelopeId: string): Promise<void> {
    this.logger.log(`Processing voided envelope ${envelopeId} for lease ${lease._id}`);

    const leaseIdString = (lease._id as any).toString();

    // Update lead status to VOIDED
    const updatedLead = await this.leadsRepository.updateSignatureStatus(leaseIdString, 'VOIDED');

    if (!updatedLead) {
      this.logger.error(`Failed to update lead ${leaseIdString} status to VOIDED`);
    }

    this.logger.log(
      `Lease ${lease._id} marked as VOIDED for envelope ${envelopeId}`,
    );
  }

  /**
   * Enhancement 3: Log envelope status history for audit trail
   * Stores status changes for compliance and debugging
   * 
   * Note: This requires a StatusHistory collection/entity to be implemented
   * For now, it logs to application logs. In production, store in database.
   */
  private async logEnvelopeStatusHistory(
    leaseId: string,
    envelopeId: string,
    status: string,
    payload: DocuSignWebhookDto,
  ): Promise<void> {
    const historyEntry = {
      leaseId,
      envelopeId,
      status,
      event: payload.event,
      timestamp: new Date(payload.generatedDateTime),
      retryCount: payload.retryCount,
      recipients: payload.data.envelopeSummary.recipients,
    };

    // Log to application logs (for now)
    this.logger.log(
      `Envelope status history: ${JSON.stringify(historyEntry)}`,
    );

    // TODO: Store in database for audit trail
    // Example implementation:
    // await this.envelopeStatusHistoryRepository.create(historyEntry);
    
    // This provides:
    // - Compliance audit trail
    // - Debugging capability
    // - Status change timeline
    // - Retry tracking
  }

  /**
   * Retrieve signed document from DocuSign
   * Downloads the completed PDF with all signatures applied
   * 
   * Requirements: 3.9
   */
  async getSignedDocument(envelopeId: string): Promise<Buffer> {
    try {
      this.logger.log(`Retrieving signed document for envelope ${envelopeId}`);

      // Get access token
      const accessToken = await this.getAccessToken();

      // Get account ID and base path
      const accountId = this.configService.get<string>('DOCUSIGN_ACCOUNT_ID')!;
      const basePath = this.configService.get<string>('DOCUSIGN_BASE_PATH')!;

      // Call DocuSign API to download signed PDF
      const response = await firstValueFrom(
        this.httpService.get(
          `${basePath}/v2.1/accounts/${accountId}/envelopes/${envelopeId}/documents/combined`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            responseType: 'arraybuffer', // Get binary data
          },
        ),
      );

      const pdfBuffer = Buffer.from(response.data);

      this.logger.log(
        `Successfully retrieved signed document for envelope ${envelopeId} (${pdfBuffer.length} bytes)`,
      );

      return pdfBuffer;
    } catch (error) {
      // Handle API errors gracefully
      this.logger.error(
        `Failed to retrieve signed document for envelope ${envelopeId}`,
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to retrieve signed document: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  /**
   * Store signed document with retry logic
   * Supports both S3 and database storage strategies
   * 
   * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
   */
  async storeSignedDocument(
    leaseId: string,
    envelopeId: string,
    pdfBuffer: Buffer,
  ): Promise<string> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(
          `Storing signed document for lease ${leaseId} (attempt ${attempt}/${maxRetries})`,
        );

        // Determine storage strategy from configuration (Requirement 9.1)
        const storageStrategy = this.configService.get<string>('STORAGE_STRATEGY') || 'database';

        let storageReference: string;

        if (storageStrategy === 's3') {
          // Implement S3 upload with unique key generation (Requirement 9.2)
          storageReference = await this.uploadToS3(leaseId, envelopeId, pdfBuffer);
        } else {
          // Implement database storage as binary data (Requirement 9.3)
          storageReference = await this.storeInDatabase(leaseId, pdfBuffer);
        }

        this.logger.log(
          `Successfully stored signed document for lease ${leaseId} using ${storageStrategy} strategy`,
        );

        return storageReference;
      } catch (error) {
        lastError = error;
        
        // Log error and retry with exponential backoff (Requirement 9.5)
        this.logger.error(
          `Storage attempt ${attempt}/${maxRetries} failed for lease ${leaseId}: ${error.message}`,
        );

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delayMs = Math.pow(2, attempt - 1) * 1000;
          this.logger.log(`Retrying in ${delayMs}ms...`);
          await this.delay(delayMs);
        }
      }
    }

    // All retries exhausted
    throw new Error(
      `Failed to store signed document after ${maxRetries} attempts: ${lastError?.message}`,
    );
  }

  /**
   * Upload signed document to S3
   * Generates unique key for storage
   */
  private async uploadToS3(
    leaseId: string,
    envelopeId: string,
    pdfBuffer: Buffer,
  ): Promise<string> {
    // Generate unique S3 key with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${envelopeId}_${timestamp}.pdf`;
    const folderPath = `signed-leases/${leaseId}`;
    
    this.logger.log(`Uploading signed document to S3: ${folderPath}/${fileName}`);

    // Upload to S3 using MediaService
    const { key } = await this.mediaService.uploadFile(
      pdfBuffer,
      'application/pdf',
      folderPath,
    );

    this.logger.log(`Successfully uploaded signed document to S3 with key: ${key}`);
    
    // Return the S3 key as the storage reference
    return key;
  }

  /**
   * Store signed document in database as binary data
   * Note: This is a placeholder implementation. In production, you would:
   * 1. Create a SignedDocument entity/schema with fields for leaseId, content (Buffer), contentType, createdAt
   * 2. Create a SignedDocumentRepository to handle database operations
   * 3. Store the PDF buffer in the database
   * 4. Return the document ID as the storage reference
   */
  private async storeInDatabase(leaseId: string, pdfBuffer: Buffer): Promise<string> {
    this.logger.log(`Storing signed document in database for lease ${leaseId} (${pdfBuffer.length} bytes)`);
    
    // TODO: Implement actual database storage when SignedDocument entity is created
    // Example implementation:
    // const signedDocument = await this.signedDocumentRepository.create({
    //   leaseId,
    //   content: pdfBuffer,
    //   contentType: 'application/pdf',
    //   createdAt: new Date(),
    // });
    // return signedDocument._id.toString();

    // For now, return a placeholder reference
    // In production, this would return the actual database document ID
    const documentId = `db-doc-${leaseId}-${Date.now()}`;
    this.logger.warn(
      `Database storage is not fully implemented. Returning placeholder reference: ${documentId}. ` +
      `To complete this implementation, create a SignedDocument entity and repository.`,
    );
    
    return documentId;
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get signed document download URL
   * Retrieves the lease, validates it's signed, and generates a presigned S3 URL
   * 
   * @param leaseId - The lease ID
   * @returns Presigned S3 URL for downloading the signed document
   * @throws NotFoundException if lease not found or not signed
   * @throws Error if S3 key is invalid or URL generation fails
   */
  async getSignedDocumentUrl(leaseId: string): Promise<string> {
    try {
      this.logger.log(`Generating download URL for signed document of lease ${leaseId}`);

      // Retrieve lead by ID (lead = lease)
      const lease = await this.leadsRepository.findById(leaseId);

      if (!lease) {
        throw new NotFoundException(`Lease not found with ID ${leaseId}`);
      }

      // Validate lease is signed
      if (lease.signatureStatus !== 'SIGNED') {
        throw new Error(
          `Lease ${leaseId} is not signed yet. Current status: ${lease.signatureStatus}`,
        );
      }

      // Validate signed document URL exists
      if (!lease.signedDocumentUrl) {
        throw new Error(
          `Lease ${leaseId} is marked as SIGNED but has no signed document reference`,
        );
      }

      // Extract S3 key from signedDocumentUrl
      // The signedDocumentUrl contains the S3 key (e.g., "signed-leases/{leaseId}/{envelopeId}_{timestamp}.pdf")
      const s3Key = lease.signedDocumentUrl;

      this.logger.log(`Generating presigned URL for S3 key: ${s3Key}`);

      // Generate presigned download URL (expires in 15 minutes by default)
      const downloadUrl = await this.mediaService.generateDownloadUrl(s3Key, 900);

      this.logger.log(
        `Successfully generated download URL for lease ${leaseId}`,
      );

      return downloadUrl;
    } catch (error) {
      this.logger.error(
        `Failed to generate download URL for lease ${leaseId}`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Generate DocuSign Recipient View URL (Embedded Signing)
   * This creates a URL that allows the recipient to sign the document directly
   * without receiving an email. The URL is valid for 5 minutes.
   * 
   * @param envelopeId - The DocuSign envelope ID
   * @param recipientEmail - Email of the recipient who will sign
   * @param recipientName - Name of the recipient
   * @param returnUrl - URL to redirect after signing (optional)
   * @returns Signing URL that the recipient can use
   * 
   * Example URL: https://na4.docusign.net/Signing/EmailStart.aspx?a=...
   */
  async generateRecipientViewUrl(
    envelopeId: string,
    recipientEmail: string,
    recipientName: string,
    returnUrl?: string,
  ): Promise<string> {
    try {
      this.logger.log(
        `Generating recipient view URL for envelope ${envelopeId}, recipient: ${recipientEmail}`,
      );

      // Get access token
      const accessToken = await this.getAccessToken();

      // Get account ID and base path
      const accountId = this.configService.get<string>('DOCUSIGN_ACCOUNT_ID')!;
      const basePath = this.configService.get<string>('DOCUSIGN_BASE_PATH')!;

      // Default return URL if not provided
      const finalReturnUrl = returnUrl || this.configService.get<string>('APP_URL') || 'http://localhost:3000';

      // Create recipient view request
      const recipientViewRequest = {
        returnUrl: finalReturnUrl,
        authenticationMethod: 'none', // No authentication required
        email: recipientEmail,
        userName: recipientName,
        clientUserId: recipientEmail, // Must match the clientUserId set when creating envelope
      };

      this.logger.log(
        `Recipient view request: ${JSON.stringify(recipientViewRequest)}`,
      );

      // Call DocuSign API to create recipient view
      const response = await firstValueFrom(
        this.httpService.post(
          `${basePath}/v2.1/accounts/${accountId}/envelopes/${envelopeId}/views/recipient`,
          recipientViewRequest,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const signingUrl = response.data.url;

      this.logger.log(
        `Successfully generated signing URL for envelope ${envelopeId}`,
      );

      return signingUrl;
    } catch (error) {
      this.logger.error(
        `Failed to generate recipient view URL for envelope ${envelopeId}`,
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to generate signing URL: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  /**
   * Send lease for signature with embedded signing (generates signing URL)
   * This creates an envelope in "created" status and returns a signing URL
   * instead of sending an email.
   * 
   * @param leaseId - The lease ID
   * @param leasePdfBuffer - PDF buffer of the lease document
   * @param recipientEmail - Recipient email
   * @param recipientName - Recipient name
   * @param returnUrl - URL to redirect after signing
   * @param signaturePosition - Optional signature position
   * @returns Object with envelope ID and signing URL
   */
  async sendLeaseForEmbeddedSigning(
    leaseId: string,
    leasePdfBuffer: Buffer,
    recipientEmail: string,
    recipientName: string,
    returnUrl: string,
    signaturePosition?: { pageNumber: number; xPosition: number; yPosition: number },
  ): Promise<{ envelopeId: string; signingUrl: string }> {
    try {
      this.logger.log(
        `Creating envelope for embedded signing - lease ${leaseId}, recipient: ${recipientEmail}`,
      );

      // Encode PDF to base64
      const pdfBase64 = leasePdfBuffer.toString('base64');

      // Build envelope definition for embedded signing
      const envelopeDefinition = this.buildEmbeddedEnvelopeDefinition(
        leaseId,
        pdfBase64,
        recipientEmail,
        recipientName,
        signaturePosition,
      );

      // Get access token
      const accessToken = await this.getAccessToken();

      // Get account ID and base path
      const accountId = this.configService.get<string>('DOCUSIGN_ACCOUNT_ID')!;
      const basePath = this.configService.get<string>('DOCUSIGN_BASE_PATH')!;

      // Create envelope (status = "created", not "sent")
      const response = await firstValueFrom(
        this.httpService.post(
          `${basePath}/v2.1/accounts/${accountId}/envelopes`,
          envelopeDefinition,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const envelopeId = response.data.envelopeId;

      this.logger.log(
        `Successfully created envelope ${envelopeId} for embedded signing`,
      );

      // Generate recipient view URL
      const signingUrl = await this.generateRecipientViewUrl(
        envelopeId,
        recipientEmail,
        recipientName,
        returnUrl,
      );

      return {
        envelopeId,
        signingUrl,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create envelope for embedded signing - lease ${leaseId}`,
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to create embedded signing envelope: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  /**
   * Build envelope definition for embedded signing
   * Sets clientUserId to enable embedded signing and status to "created"
   */
  private buildEmbeddedEnvelopeDefinition(
    leaseId: string,
    pdfBase64: string,
    recipientEmail: string,
    recipientName: string,
    signaturePosition?: { pageNumber: number; xPosition: number; yPosition: number },
  ): EnvelopeDefinition {
    // Default signature position if not provided
    const sigPosition = signaturePosition || {
      pageNumber: 1,
      xPosition: 100,
      yPosition: 200,
    };

    const envelopeDefinition: EnvelopeDefinition = {
      emailSubject: `Please sign your lease agreement - ${leaseId}`,
      documents: [
        {
          documentBase64: pdfBase64,
          name: `Lease_${leaseId}.pdf`,
          fileExtension: 'pdf',
          documentId: '1',
        },
      ],
      recipients: {
        signers: [
          {
            email: recipientEmail,
            name: recipientName,
            recipientId: '1',
            routingOrder: '1',
            clientUserId: recipientEmail, // CRITICAL: This enables embedded signing
            tabs: {
              signHereTabs: [
                {
                  documentId: '1',
                  pageNumber: sigPosition.pageNumber.toString(),
                  xPosition: sigPosition.xPosition.toString(),
                  yPosition: sigPosition.yPosition.toString(),
                },
              ],
            },
          },
        ],
      },
      status: 'sent', // Must be "sent" to generate recipient view
    };

    return envelopeDefinition;
  }
}
