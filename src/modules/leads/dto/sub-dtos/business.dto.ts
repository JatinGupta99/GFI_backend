import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class BusinessDetailsDto {
    @IsOptional() @IsString() legalName?: string;
    @IsOptional() @IsString() taxId?: string;
    @IsOptional() @IsString() typeOfEntity?: string;
    @IsOptional() @IsString() stateOfIncorporation?: string;
    @IsOptional() @IsString() corporateAddress?: string;
    @IsOptional() @IsString() businessTelephone?: string;
    @IsOptional() @IsString() businessDescription?: string;
    @IsOptional() @IsString() tradeName?: string;
    @IsOptional() @IsNumber() yearsInBusiness?: number;
    @IsOptional() @IsBoolean() areYouLicensed?: boolean;
    @IsOptional() @IsNumber() numLocations?: number;
    @IsOptional() @IsBoolean() areYouRelocating?: boolean;
}
