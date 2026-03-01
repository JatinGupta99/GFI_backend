import { IsOptional, IsString, IsBoolean, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Business DTO
export class PublicBusinessDto {
  @IsOptional() @IsString() legalName?: string;
  @IsOptional() @IsString() stateOfIncorporation?: string;
  @IsOptional() @IsString() fein?: string;
  @IsOptional() @IsString() tradeName?: string;
  @IsOptional() @IsString() currentBusinessAddress?: string;
  @IsOptional() @IsString() proposedBusinessDescription?: string;
  @IsOptional() @IsString() businessTelephone?: string;
  @IsOptional() @IsBoolean() isRelocating?: boolean;
  @IsOptional() @IsNumber() howLongInBusiness?: number;
  @IsOptional() @IsNumber() howManyLocations?: number;
}

// Financial Assets DTO
export class PublicAssetsDto {
  @IsOptional() @IsBoolean() checkingSavings?: boolean;
  @IsOptional() @IsBoolean() stocksBonds?: boolean;
  @IsOptional() @IsBoolean() retirementAccounts?: boolean;
  @IsOptional() automobiles?: number | string;
  @IsOptional() realEstateResidence?: number | string;
  @IsOptional() realEstateInvestment?: number | string;
  @IsOptional() @IsString() otherAssets?: string;
}

// Financial Liabilities DTO
export class PublicLiabilitiesDto {
  @IsOptional() creditCardBalances?: number | string;
  @IsOptional() taxesPayable?: number | string;
  @IsOptional() mortgagesDue?: number | string;
  @IsOptional() @IsString() otherLiabilities?: string;
}

// Financial DTO
export class PublicFinancialDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PublicAssetsDto)
  assets?: PublicAssetsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PublicLiabilitiesDto)
  liabilities?: PublicLiabilitiesDto;

  @IsOptional() annualIncome?: number | string;
  @IsOptional() monthlyMortgageRent?: number | string;
}

// Professional Reference DTO
export class PublicProfessionalReferenceDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
}

// References DTO
export class PublicReferencesDto {
  @IsOptional() @IsString() bankReference?: string;
  @IsOptional() @IsString() bankOfficerName?: string;
  @IsOptional() @IsString() bankOfficerPhone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PublicProfessionalReferenceDto)
  professionalReference1?: PublicProfessionalReferenceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PublicProfessionalReferenceDto)
  professionalReference2?: PublicProfessionalReferenceDto;
}

// General DTO
export class PublicGeneralDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() dob?: string;
  @IsOptional() @IsString() ssn?: string;
  @IsOptional() @IsString() spouseName?: string;
  @IsOptional() @IsString() spouseDob?: string;
  @IsOptional() @IsString() spouseSsn?: string;
  @IsOptional() @IsString() residentialAddress?: string;
  @IsOptional() howLongAtAddress?: number | string;
  @IsOptional() @IsString() presentEmployer?: string;
  @IsOptional() @IsString() businessExperienceSummary?: string;
  @IsOptional() @IsBoolean() hasCoApplicant?: boolean;
  @IsOptional() @IsBoolean() driversLicenseUploaded?: boolean;
  @IsOptional() @IsString() notes?: string;
}

// Main Public Update DTO
export class UpdateLeadPublicDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PublicBusinessDto)
  business?: PublicBusinessDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PublicFinancialDto)
  financial?: PublicFinancialDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PublicReferencesDto)
  references?: PublicReferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PublicGeneralDto)
  general?: PublicGeneralDto;
}
