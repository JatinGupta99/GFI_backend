import { IsString, IsEmail, IsArray, IsOptional, IsNumber, IsEnum, IsNotEmpty } from 'class-validator';

export enum EmailTemplateType {
  LOI = 'LOI',
  COURTESY_NOTICE = 'COURTESY_NOTICE',
  THREE_DAY_NOTICE = 'THREE_DAY_NOTICE',
  ATTORNEY_NOTICE = 'ATTORNEY_NOTICE',
  RENEWAL_LETTER = 'RENEWAL_LETTER',
  GENERAL = 'GENERAL',
}

export enum RecordType {
  LEAD = 'LEAD',
  RENEWAL = 'RENEWAL',
  LEASE = 'LEASE',
}

export class SendGenericEmailDto {
  @IsString()
  to: string;
  
  @IsString()
  @IsOptional()
  Key?: string;

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  cc?: string[];

  @IsString()
  subject: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[]; // Array of S3 keys or file URLs

  @IsOptional()
  @IsNumber()
  followUpDays?: number;

  @IsOptional()
  @IsNumber()
  followUpAutomatedDay?: number;

  @IsOptional()
  @IsEnum(EmailTemplateType)
  emailType?: EmailTemplateType;

  @IsNotEmpty()
  @IsString()
  leadId: string; // Lead/Renewal/Lease ID

  @IsOptional()
  @IsEnum(RecordType)
  recordType?: RecordType;
  
  
  @IsOptional()
  @IsString()
  docusignUri?:string;// Type of record: LEAD, RENEWAL, or LEASE
}
