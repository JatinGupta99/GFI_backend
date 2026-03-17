import { IsString, IsNotEmpty, IsOptional, IsEmail, IsArray, ValidateIf } from 'class-validator';

export class CreateSenderViewDto {
  @IsString()
  @IsNotEmpty()
  Key: string; // S3 key of the LOI PDF

  @ValidateIf((o) => o.recipientEmail != null && o.recipientEmail !== '')
  @IsEmail()
  @IsOptional()
  recipientEmail?: string;

  @IsString()
  @IsOptional()
  returnUrl?: string; // Where DocuSign redirects after sender finishes tagging
}

export class SenderViewResponseDto {
  envelopeId: string;
  senderViewUrl: string;
}
