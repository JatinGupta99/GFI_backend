import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { LeadStatus } from '../../../common/enums/common-enums';
import { Type } from 'class-transformer';
import { GeneralDetailsDto } from './sub-dtos/general.dto';
import { BusinessDetailsDto } from './sub-dtos/business.dto';
import { FinancialDetailsDto } from './sub-dtos/financial.dto';
import { DealTermsDto } from './sub-dtos/deal-terms.dto';
import { DraftingDetailsDto } from './sub-dtos/drafting.dto';
import { ReferenceInfoDto } from './sub-dtos/reference.dto';
import { AccountingDetailsDto } from './sub-dtos/accounting.dto';
import { BrokerInfoDto } from './sub-dtos/broker.dto';
import { FileInfoDto } from './sub-dtos/file.dto';
import { ActivityLogDto } from './sub-dtos/activity.dto';

export class CreateLeadDto {
  @IsOptional() @IsEnum(LeadStatus) status?: LeadStatus;

  @IsOptional() @ValidateNested() @Type(() => GeneralDetailsDto) general?: GeneralDetailsDto;
  @IsOptional() @ValidateNested() @Type(() => BusinessDetailsDto) business?: BusinessDetailsDto;
  @IsOptional() @ValidateNested() @Type(() => FinancialDetailsDto) financial?: FinancialDetailsDto;
  @IsOptional() @ValidateNested() @Type(() => DealTermsDto) dealTerms?: DealTermsDto;
  @IsOptional() @ValidateNested() @Type(() => DraftingDetailsDto) current_negotiation?: DraftingDetailsDto;
  @IsOptional() @ValidateNested() @Type(() => DraftingDetailsDto) budget_negotiation?: DraftingDetailsDto;
  @IsOptional() @ValidateNested() @Type(() => DraftingDetailsDto) drafting?: DraftingDetailsDto;
  @IsOptional() @ValidateNested() @Type(() => ReferenceInfoDto) references?: ReferenceInfoDto;
  @IsOptional() @ValidateNested() @Type(() => AccountingDetailsDto) accounting?: AccountingDetailsDto;
  @IsOptional() @ValidateNested() @Type(() => BrokerInfoDto) broker?: BrokerInfoDto;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => FileInfoDto) files?: FileInfoDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ActivityLogDto) activities?: ActivityLogDto[];

  @IsOptional() @IsString() createdBy?: string;
  @IsOptional() @IsString() lastModifiedBy?: string;
}
