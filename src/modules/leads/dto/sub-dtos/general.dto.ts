import { IsEmail, IsOptional, IsString } from 'class-validator';

export class GeneralDetailsDto {
    @IsOptional() @IsString() firstName?: string;
    @IsOptional() @IsString() lastName?: string;
    @IsOptional() @IsEmail() email?: string;
    @IsOptional() @IsString() cellPhone?: string;
    @IsOptional() @IsString() workPhone?: string;
    @IsOptional() @IsString() jobTitle?: string;
    @IsOptional() @IsString() spouseName?: string;
    @IsOptional() @IsString() businessName?: string;
    @IsOptional() @IsString() mailingAddress?: string;
    @IsOptional() @IsString() residentialAddress?: string;
    @IsOptional() @IsString() city?: string;
    @IsOptional() @IsString() state?: string;
    @IsOptional() @IsString() zip?: string;
    @IsOptional() @IsString() property?: string;
    @IsOptional() @IsString() use?: string;
    @IsOptional() @IsString() suite?: string;
    @IsOptional() @IsString() sf?: string;
}
