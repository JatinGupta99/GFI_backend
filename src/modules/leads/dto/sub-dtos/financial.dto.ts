import { IsNumber, IsOptional, IsString } from 'class-validator';

export class FinancialDetailsDto {
    @IsOptional() @IsNumber() assetsCheckingAcct?: number;
    @IsOptional() @IsNumber() assetsSavingsAcct?: number;
    @IsOptional() @IsNumber() assetsStocksBonds?: number;
    @IsOptional() @IsNumber() assetsRealEstate?: number;
    @IsOptional() @IsNumber() totalAssets?: number;
    @IsOptional() @IsNumber() totalLiabilities?: number;
    @IsOptional() @IsNumber() netWorth?: number;
    @IsOptional() @IsNumber() creditScore?: number;
    @IsOptional() @IsNumber() liquidAssets?: number;
    @IsOptional() @IsString() guarantorSsn?: string;
    @IsOptional() @IsString() guarantor?: string;
    @IsOptional() @IsNumber() annualIncome?: number;
    @IsOptional() @IsString() sourceOfIncome?: string;
    @IsOptional() @IsString() qualifier?: string;
}
