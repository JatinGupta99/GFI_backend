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
}

export class AgreementDto {
    @IsOptional() @IsBoolean() term?: boolean;
    @IsOptional() @IsBoolean() baseRent?: boolean;
    @IsOptional() @IsBoolean() annualIncrease?: boolean;
    @IsOptional() @IsBoolean() rcd?: boolean;
    @IsOptional() @IsBoolean() nnn?: boolean;
    @IsOptional() @IsBoolean() camCap?: boolean;
    @IsOptional() @IsBoolean() camCapDetails?: boolean;
    @IsOptional() @IsBoolean() insReimbursement?: boolean;
    @IsOptional() @IsBoolean() insReimbursementDetails?: boolean;
}

export class NegotiationRoundDto {
    @IsOptional() @IsString() id?: string;
    @IsOptional() @IsString() label?: string;
    @IsOptional() @ValidateNested() @Type(() => NegotiationValuesDto) initialValues?: NegotiationValuesDto;
    @IsOptional() @ValidateNested() @Type(() => NegotiationValuesDto) counterValues?: NegotiationValuesDto;
    @IsOptional() @ValidateNested() @Type(() => AgreementDto) agreement?: AgreementDto;
}

export class DealTermsDto {
    @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => NegotiationRoundDto) rounds?: NegotiationRoundDto[];
}
