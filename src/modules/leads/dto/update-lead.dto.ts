import { PartialType } from '@nestjs/mapped-types';
import { CreateLeadDto } from './create-lead.dto';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { LeadStatus } from '../../../common/enums/common-enums';

export class UpdateLeadDto extends PartialType(CreateLeadDto) {}

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
