import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class NegotiationValuesDto {
    @IsOptional() @IsString() term?: string;
    @IsOptional() @IsNumber() baseRent?: number;
    @IsOptional() @IsString() annualIncrease?: string;
    @IsOptional() @IsString() rcd?: string;
    @IsOptional() @IsNumber() nnn?: number;
    @IsOptional() @IsString() camCap?: string;
    @IsOptional() @IsString() camCapDetails?: string;
    @IsOptional() @IsString() insReimbursement?: string;
    @IsOptional() @IsString() insReimbursementDetails?: string;
    @IsOptional() @IsString() retReimbursement?: string;
    @IsOptional() @IsString() retReimbursementDetails?: string;
    @IsOptional() @IsString() securityDeposit?: string;
    @IsOptional() @IsString() securityDepositDetails?: string;
    @IsOptional() @IsString() prepaidRent?: string;
    @IsOptional() @IsString() use?: string;
    @IsOptional() @IsString() exclusiveUse?: string;
    @IsOptional() @IsString() option?: string;
    @IsOptional() @IsString() optionDetails?: string;
    @IsOptional() @IsString() guaranty?: string;
    @IsOptional() @IsString() guarantyDetails?: string;
    @IsOptional() @IsString() tiAllowance?: string;
    @IsOptional() @IsString() tiAllowanceDetails?: string;
    @IsOptional() @IsString() percentageRent?: string;
    @IsOptional() @IsString() percentageRentDetails?: string;
    @IsOptional() @IsString() deliveryOfSpace?: string;
}

export class NegotiationRoundDto {
    @IsOptional() @IsString() id?: string;
    @IsOptional() @IsString() label?: string;
    @IsOptional() @ValidateNested() @Type(() => NegotiationValuesDto) initial?: NegotiationValuesDto;
    @IsOptional() @ValidateNested() @Type(() => NegotiationValuesDto) counter?: NegotiationValuesDto;
}

export class DealTermsDto {
    @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => NegotiationRoundDto) rounds?: NegotiationRoundDto[];
}

export class UpdateDealTermsDto {
    @IsArray() @ValidateNested({ each: true }) @Type(() => NegotiationRoundDto) rounds: NegotiationRoundDto[];
}
