import { PartialType } from '@nestjs/mapped-types';
import { CreateLeadDto } from './create-lead.dto';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LeadStatus } from '../../../common/enums/common-enums';

class BudgetSheetChargesDto {
  @IsOptional()
  @IsNumber()
  baseRentMonth?: number;

  @IsOptional()
  @IsNumber()
  camMonth?: number;

  @IsOptional()
  @IsNumber()
  insMonth?: number;

  @IsOptional()
  @IsNumber()
  taxMonth?: number;

  @IsOptional()
  @IsNumber()
  totalDueMonth?: number;
}

class BudgetSheetLeaseTermsDto {
  @IsOptional()
  @IsString()
  rentDueDate?: string | null;

  @IsOptional()
  @IsString()
  lateAfter?: string | null;

  @IsOptional()
  @IsNumber()
  lateFee?: number;
}

class BudgetSheetMonthlyPaymentsDto {
  @IsOptional()
  @IsNumber()
  jan?: number;

  @IsOptional()
  @IsNumber()
  feb?: number;

  @IsOptional()
  @IsNumber()
  mar?: number;

  @IsOptional()
  @IsNumber()
  apr?: number;

  @IsOptional()
  @IsNumber()
  may?: number;

  @IsOptional()
  @IsNumber()
  jun?: number;

  @IsOptional()
  @IsNumber()
  jul?: number;

  @IsOptional()
  @IsNumber()
  aug?: number;

  @IsOptional()
  @IsNumber()
  sept?: number;

  @IsOptional()
  @IsNumber()
  oct?: number;

  @IsOptional()
  @IsNumber()
  nov?: number;

  @IsOptional()
  @IsNumber()
  dec?: number;
}

class BudgetSheetDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BudgetSheetChargesDto)
  charges?: BudgetSheetChargesDto;

  @IsOptional()
  @IsNumber()
  balanceDue?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BudgetSheetLeaseTermsDto)
  leaseTerms?: BudgetSheetLeaseTermsDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BudgetSheetMonthlyPaymentsDto)
  monthlyPayments?: BudgetSheetMonthlyPaymentsDto;
}

export class UpdateLeadDto extends PartialType(CreateLeadDto) {

  @IsOptional()
  @IsString()
  loiDocumentUrl?:string;
  
  @IsOptional()
  @IsString()
  pdfDocumentUrl?:string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BudgetSheetDto)
  budget_sheet?: BudgetSheetDto;
}

export class FindLeadsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string; // searches name/email/property

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 25;
}
