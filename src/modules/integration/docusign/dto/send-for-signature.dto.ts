import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsObject,
  ValidateNested,
  IsNumber,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

class SignaturePositionDto {
  @IsNumber()
  pageNumber: number;

  @IsNumber()
  xPosition: number;

  @IsNumber()
  yPosition: number;
}

export class SendForSignatureDto {
  @IsString()
  @IsNotEmpty()
  leaseId: string; // Optional since it's in the URL path

  @IsEmail()
  @IsOptional()
  recipientEmail?: string;

  @IsString()
  @IsOptional()
  body?:string;
  
  @IsArray()
  @IsEmail({}, { each: true })
  @IsOptional()
  cc?: string[];

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => SignaturePositionDto)
  signaturePosition?: SignaturePositionDto;

  @IsBoolean()
  @IsOptional()
  isTesting?: boolean = false;

  @IsString()
  @IsOptional()
  Key?: string; // Single PDF key/URL

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  fileKey?: string[]; // Array of PDF keys (alternative to Key)
}
