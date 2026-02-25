import { IsString, IsNotEmpty, IsUrl, IsOptional } from 'class-validator';

/**
 * DTO for generating DocuSign signing URL
 */
export class GenerateSigningUrlDto {
  @IsString()
  @IsNotEmpty()
  leaseId: string;

  @IsString()
  @IsNotEmpty()
  recipientEmail: string;

  @IsString()
  @IsNotEmpty()
  recipientName: string;

  @IsUrl()
  @IsOptional()
  returnUrl?: string; // URL to redirect after signing (default: your app URL)
}
