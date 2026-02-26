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
  leaseId: string;

  @IsEmail()
  @IsOptional()
  recipientEmail?: string;

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
  isTesting?: boolean = true;
}
