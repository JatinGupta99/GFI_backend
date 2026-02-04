import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';

export class ProfessionalReferenceDto {
    @IsOptional() @IsString() name?: string;
    @IsOptional() @IsString() phone?: string;
}

export class ReferenceInfoDto {
    @IsOptional() @IsString() bankReference?: string;
    @IsOptional() @IsString() bankOfficerName?: string;
    @IsOptional() @IsString() bankOfficerPhone?: string;
    @IsOptional() @ValidateNested() @Type(() => ProfessionalReferenceDto) professionalReference1?: ProfessionalReferenceDto;
    @IsOptional() @ValidateNested() @Type(() => ProfessionalReferenceDto) professionalReference2?: ProfessionalReferenceDto;
}
