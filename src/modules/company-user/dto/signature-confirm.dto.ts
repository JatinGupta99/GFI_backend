import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignatureConfirmDto {
  @ApiProperty({ description: 'S3 key of the uploaded signature file' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ description: 'Original filename of the signature' })
  @IsString()
  @IsOptional()
  fileName?: string;

  @ApiProperty({ description: 'File size in bytes' })
  @IsNumber()
  @IsOptional()
  fileSize?: number;

  @ApiProperty({ description: 'MIME type of the file' })
  @IsString()
  @IsOptional()
  fileType?: string;
}