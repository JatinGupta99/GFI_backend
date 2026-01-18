import { IsNumber, IsOptional, IsString } from 'class-validator';

export class DraftingDetailsDto {
    @IsOptional() @IsNumber() rentPerSf?: number;
    @IsOptional() @IsNumber() annInc?: number;
    @IsOptional() @IsNumber() freeMonths?: number;
    @IsOptional() @IsString() ti?: string;
    @IsOptional() @IsNumber() tiPerSf?: number;
    @IsOptional() @IsString() rcd?: string;
}
