import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class BusinessDetailsDto {
    @IsOptional() @IsString() legalName?: string;
    @IsOptional() @IsString() fein?: string;
    @IsOptional() @IsString() stateOfIncorporation?: string;
    @IsOptional() @IsString() tradeName?: string;
    @IsOptional() @IsString() currentBusinessAddress?: string;
    @IsOptional() @IsString() proposedBusinessDescription?: string;
    @IsOptional() @IsString() businessTelephone?: string;
    @IsOptional() @IsString() isRelocating?: string;
    @IsOptional() @IsString() howLongInBusiness?: string;
    @IsOptional() @IsString() howManyLocations?: string;
    @IsOptional() @IsString() typeOfEntity?: string;
}
