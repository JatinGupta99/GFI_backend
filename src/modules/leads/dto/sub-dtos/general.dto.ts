import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

export class GeneralDetailsDto {
    @IsOptional() @IsString() name?: string;
    @IsOptional() @IsString() firstName?: string;
    @IsOptional() @IsString() lastName?: string;
    @IsOptional() @IsString() dob?: string;
    @IsOptional() @IsString() ssn?: string;
    @IsOptional() @IsString() spouseName?: string;
    @IsOptional() @IsString() spouseDob?: string;
    @IsOptional() @IsString() spouseSsn?: string;
    @IsOptional() @IsString() residentialAddress?: string;
    @IsOptional() @IsString() howLongAtAddress?: string;
    @IsOptional() @IsString() presentEmployer?: string;
    @IsOptional() @IsString() businessExperienceSummary?: string;
    @IsOptional() @IsBoolean() hasCoApplicant?: boolean;
    @IsOptional() @IsBoolean() driversLicenseUploaded?: boolean;
    @IsOptional() @IsString() email?: string;
    @IsOptional() @IsString() cellPhone?: string;
    @IsOptional() @IsString() workPhone?: string;
    @IsOptional() @IsString() businessName?: string;
    @IsOptional() @IsString() mailingAddress?: string;
    @IsOptional() @IsString() use?: string;
    @IsOptional() @IsString() property?: string;
    @IsOptional() @IsString() suite?: string;
    @IsOptional() @IsString() sf?: string;
    @IsOptional() @IsString() notes?: string;
}
