import { IsString, IsEmail, IsOptional, IsArray, IsIn, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendEmailDto {
  @ApiProperty({ 
    description: 'Primary recipient email address',
    example: 'tenant@example.com'
  })
  @IsEmail({}, { message: 'Invalid email format for recipient' })
  to: string;

  @ApiPropertyOptional({ 
    description: 'CC recipients email addresses',
    example: ['manager@company.com', 'legal@company.com'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true, message: 'Invalid email format in CC list' })
  cc?: string[];

  @ApiPropertyOptional({ 
    description: 'BCC recipients email addresses',
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true, message: 'Invalid email format in BCC list' })
  bcc?: string[];

  @ApiProperty({ 
    description: 'Email subject line',
    example: 'LOI for Suite 100 at Property Name'
  })
  @IsString()
  subject: string;

  @ApiProperty({ 
    description: 'HTML email body content',
    example: '<div>HTML email content...</div>'
  })
  @IsString()
  body: string;

  @ApiPropertyOptional({ 
    description: 'Array of attachment IDs or S3 keys',
    example: ['attachment-id-1', 'attachment-id-2'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @ApiPropertyOptional({ 
    description: 'S3 key for LOI document',
    example: 'documents/lead-69a49bcc4a4f3730af4d3b58/loi-pdf-s3-key'
  })
  @IsOptional()
  @IsString()
  Key?: string;

  @ApiPropertyOptional({ 
    description: 'Email priority level',
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  })
  @IsOptional()
  @IsIn(['low', 'normal', 'high'])
  priority?: 'low' | 'normal' | 'high';

  @ApiPropertyOptional({ 
    description: 'Additional metadata for tracking and logging',
    example: { leadId: '123', propertyId: '456', templateId: 'loi-template' }
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}