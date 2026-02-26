import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class AssetsDto {
    @IsOptional() @IsBoolean() checkingSavings?: boolean;
    @IsOptional() @IsBoolean() stocksBonds?: boolean;
    @IsOptional() @IsBoolean() retirementAccounts?: boolean;
    @IsOptional() @IsString() automobiles?: string;
    @IsOptional() @IsString() realEstateResidence?: string;
    @IsOptional() @IsString() realEstateInvestment?: string;
    @IsOptional() @IsString() otherAssets?: string;
}

export class LiabilitiesDto {
    @IsOptional() @IsString() creditCardBalances?: string;
    @IsOptional() @IsString() taxesPayable?: string;
    @IsOptional() @IsString() mortgagesDue?: string;
    @IsOptional() @IsString() otherLiabilities?: string;
}

export class FinancialDetailsDto {
    @IsOptional() @ValidateNested() @Type(() => AssetsDto) assets?: AssetsDto;
    @IsOptional() @ValidateNested() @Type(() => LiabilitiesDto) liabilities?: LiabilitiesDto;
    @IsOptional() @IsString() annualIncome?: string;
    @IsOptional() @IsString() monthlyMortgageRent?: string;
    @IsOptional() @IsString() guarantor?: string;
    @IsOptional() @IsString() guarantorSsn?: string;
    @IsOptional() @IsString() totalLiabilities?: string;
    @IsOptional() @IsString() netWorth?: string;
    @IsOptional() @IsString() assetsCheckingAcct?: string;
    @IsOptional() @IsString() assetsSavingsAcct?: string;
    @IsOptional() @IsString() assetsRealEstate?: string;
    @IsOptional() @IsString() assetsStocksBonds?: string;
    @IsOptional() @IsString() creditScore?: string;
    @IsOptional() @IsString() liquidAssets?: string;
    @IsOptional() @IsString() totalAssets?: string;
}
