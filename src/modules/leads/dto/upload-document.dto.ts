import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DocumentType } from '../../../common/enums/common-enums';

export class UploadDocumentDto {
  @IsNotEmpty()
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @IsNotEmpty()
  @IsString()
  contentType: string;

  @IsOptional()
  @IsString()
  fileName?: string;
}

export class ConfirmDocumentUploadDto {
  @IsNotEmpty()
  @IsString()
  key: string;

  @IsNotEmpty()
  @IsString()
  fileName: string;

  @IsNotEmpty()
  @IsEnum(DocumentType)
  documentType: DocumentType;
}
