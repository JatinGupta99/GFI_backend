import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateLeaseDto {
  @IsEmail()
  @IsNotEmpty()
  tenantEmail: string;

  @IsString()
  @IsNotEmpty()
  tenantName: string;

  @IsString()
  @IsOptional()
  pdfDocumentUrl?: string;

  @IsString()
  @IsOptional()
  propertyId?: string;

  @IsString()
  @IsOptional()
  suiteId?: string;
}
