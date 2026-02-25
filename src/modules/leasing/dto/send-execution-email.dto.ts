import { IsString, IsNotEmpty, IsArray, IsOptional, IsNumber, IsEmail, Min } from 'class-validator';

/**
 * DTO for sending lease execution email
 */
export class SendExecutionEmailDto {
  @IsEmail()
  @IsNotEmpty()
  to: string;

  @IsArray()
  @IsEmail({}, { each: true })
  @IsOptional()
  cc?: string[];

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  docusignUri: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  taskFollowUpDays?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  emailFollowUpDays?: number;
}
