import {
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AnnualPMTDto {
  @IsOptional() @IsNumber() janPmt?: number;
  @IsOptional() @IsNumber() febPmt?: number;
  @IsOptional() @IsNumber() marPmt?: number;
  @IsOptional() @IsNumber() aprPmt?: number;
  @IsOptional() @IsNumber() mayPmt?: number;
  @IsOptional() @IsNumber() junPmt?: number;
  @IsOptional() @IsNumber() julPmt?: number;
  @IsOptional() @IsNumber() augPmt?: number;
  @IsOptional() @IsNumber() septPmt?: number;
  @IsOptional() @IsNumber() octPmt?: number;
  @IsOptional() @IsNumber() novPmt?: number;
  @IsOptional() @IsNumber() decPmt?: number;
}

export class AccountingDetailsDto {
  @IsOptional() @IsNumber() baseRent?: number;
  @IsOptional() @IsNumber() cam?: number;
  @IsOptional() @IsNumber() ins?: number;
  @IsOptional() @IsNumber() tax?: number;
  @IsOptional() @IsNumber() totalDue?: number;
  @IsOptional() @IsNumber() balanceDue?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() rentDueDate?: string;
  @IsOptional() @IsString() lateAfter?: string;
  @IsOptional() @IsNumber() lateFee?: number;
  @IsOptional() @IsNumber() balance_forward_0131?: number;
  @IsOptional() @IsNumber() feb_cash_received?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnnualPMTDto)
  annualPMT?: AnnualPMTDto;
}