import { IsString, IsNumber, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for DocuSign webhook envelope summary
 * Contains envelope status and recipient information
 */
class EnvelopeSummaryDto {
  @IsString()
  status: string;

  @IsString()
  emailSubject: string;

  @IsString()
  envelopeId: string;

  @IsObject()
  recipients: any;
}

/**
 * DTO for DocuSign webhook data payload
 * Contains account, user, and envelope information
 */
class WebhookDataDto {
  @IsString()
  accountId: string;

  @IsString()
  userId: string;

  @IsString()
  envelopeId: string;

  @ValidateNested()
  @Type(() => EnvelopeSummaryDto)
  envelopeSummary: EnvelopeSummaryDto;
}

/**
 * DTO for DocuSign webhook payload
 * Validates incoming webhook requests from DocuSign Connect
 * 
 * Requirements: 7.2
 */
export class DocuSignWebhookDto {
  @IsString()
  event: string; // 'envelope-completed', 'envelope-sent', etc.

  @IsString()
  apiVersion: string;

  @IsString()
  uri: string;

  @IsNumber()
  retryCount: number;

  @IsString()
  generatedDateTime: string;

  @ValidateNested()
  @Type(() => WebhookDataDto)
  data: WebhookDataDto;
}
