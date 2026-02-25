import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { EnvelopeDefinition } from './interfaces/envelope-definition.interface';
import { EnvelopeResponseDto } from './dto/envelope-response.dto';
import { SendForSignatureDto } from './dto/send-for-signature.dto';
import { DocuSignWebhookDto } from './dto/docusign-webhook.dto';
import { LeaseRepository } from '../../leasing/repository/lease.repository';
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
    private readonly leaseRepository: LeaseRepository,
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

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${basePath}/oauth/token`,
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

    return {
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
  }

  /**
   * Handle webhook event from DocuSign
   * Processes envelope status changes and updates lease records
   * 
   * Requirements: 3.4, 3.5, 3.6, 3.7, 3.8, 3.9
   */
  async handleWebhookEvent(payload: DocuSignWebhookDto): Promise<void> {
    // Parse envelope status from webhook payload (Requirement 3.4)
    const envelopeStatus = payload.data.envelopeSummary.status;
    const envelopeId = payload.data.envelopeId;

    this.logger.log(
      `Processing webhook for envelope ${envelopeId} with status: ${envelopeStatus}`,
    );

    // Filter for "completed" status events (Requirement 3.5)
    if (envelopeStatus !== 'completed') {
      this.logger.log(
        `Ignoring webhook for envelope ${envelopeId} with status ${envelopeStatus}`,
      );
      return;
    }

    // Find lease by envelope ID (Requirement 3.6)
    const lease = await this.leaseRepository.findByEnvelopeId(envelopeId);

    // Handle missing lease gracefully (Requirement 3.7)
    if (!lease) {
      this.logger.warn(
        `No lease found for envelope ${envelopeId}. This may be a test envelope or the lease was deleted.`,
      );
      return;
    }

    this.logger.log(
      `Found lease ${lease._id} for envelope ${envelopeId}. Processing completion...`,
    );

    // Retrieve signed document from DocuSign (Requirement 3.9)
    const signedPdfBuffer = await this.getSignedDocument(envelopeId);

    // Store signed document with retry logic
    const leaseIdString = (lease._id as any).toString();
    const storageReference = await this.storeSignedDocument(
      leaseIdString,
      envelopeId,
      signedPdfBuffer,
    );

    // Update lease status to SIGNED with document reference (Requirement 3.8)
    // This ensures consistency between status and document reference (Requirement 9.6)
    await this.leaseRepository.updateSignedDocument(
      leaseIdString,
      storageReference,
    );

    this.logger.log(
      `Successfully processed webhook for envelope ${envelopeId}. ` +
      `Lease ${lease._id} status updated to SIGNED with document reference: ${storageReference}`,
    );
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
}
