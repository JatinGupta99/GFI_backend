import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Request } from 'express';

/**
 * Guard to validate HMAC signature for DocuSign webhook requests
 * Implements HMAC-SHA256 signature verification with constant-time comparison
 * 
 * Requirements: 3.1, 3.2, 3.3, 10.1, 10.2, 10.3, 10.4, 10.7
 */
@Injectable()
export class HmacValidationGuard implements CanActivate {
  private readonly logger = new Logger(HmacValidationGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();
    
    // Extract X-DocuSign-Signature-1 header
    const receivedSignature = request.headers['x-docusign-signature-1'] as string;
    
    if (!receivedSignature) {
      this.logger.warn(
        `Webhook validation failed: Missing X-DocuSign-Signature-1 header. ` +
        `Source IP: ${request.ip}, Timestamp: ${new Date().toISOString()}`,
      );
      throw new UnauthorizedException('Missing HMAC signature header');
    }

    // Get raw request body for HMAC computation
    const rawBody = request.rawBody;
    
    if (!rawBody) {
      this.logger.error(
        `Webhook validation failed: Raw body not available. ` +
        `Ensure body-parser is configured with verify callback. ` +
        `Source IP: ${request.ip}, Timestamp: ${new Date().toISOString()}`,
      );
      throw new UnauthorizedException('Raw body not available for signature validation');
    }

    // Get webhook secret from configuration
    const webhookSecret = this.configService.get<string>('DOCUSIGN_WEBHOOK_SECRET');
    
    if (!webhookSecret) {
      this.logger.error('DOCUSIGN_WEBHOOK_SECRET is not configured');
      throw new UnauthorizedException('Webhook secret not configured');
    }

    // Compute HMAC-SHA256 signature
    const computedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('base64');

    // Perform constant-time comparison to prevent timing attacks
    const isValid = this.constantTimeCompare(receivedSignature, computedSignature);

    if (!isValid) {
      this.logger.warn(
        `Webhook validation failed: Invalid HMAC signature. ` +
        `Source IP: ${request.ip}, Timestamp: ${new Date().toISOString()}`,
      );
      throw new UnauthorizedException('Invalid HMAC signature');
    }

    // Log successful validation
    this.logger.log(
      `Webhook validation successful. ` +
      `Source IP: ${request.ip}, Timestamp: ${new Date().toISOString()}`,
    );

    return true;
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   * Uses crypto.timingSafeEqual for secure comparison
   */
  private constantTimeCompare(a: string, b: string): boolean {
    try {
      // Convert strings to buffers for constant-time comparison
      const bufferA = Buffer.from(a);
      const bufferB = Buffer.from(b);

      // If lengths differ, still perform comparison to maintain constant time
      if (bufferA.length !== bufferB.length) {
        // Compare against a dummy buffer of the same length as bufferA
        // This ensures timing remains constant regardless of length mismatch
        crypto.timingSafeEqual(bufferA, Buffer.alloc(bufferA.length));
        return false;
      }

      return crypto.timingSafeEqual(bufferA, bufferB);
    } catch (error) {
      // If any error occurs during comparison, return false
      this.logger.error(`Error during constant-time comparison: ${error.message}`);
      return false;
    }
  }
}
