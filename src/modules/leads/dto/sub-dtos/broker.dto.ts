import { IsNumber, IsOptional, IsString } from 'class-validator';

export class BrokerInfoDto {
    @IsOptional() @IsString() brokerParticipation?: string;
    @IsOptional() @IsString() companyName?: string;
    @IsOptional() @IsString() companyAddress?: string;
    @IsOptional() @IsString() companyPhone?: string;
    @IsOptional() @IsString() contactName?: string;
    @IsOptional() @IsString() email?: string;
    @IsOptional() @IsString() phone?: string;
    @IsOptional() @IsString() commissionStructure?: string;
    @IsOptional() @IsNumber() commissionAmount?: number;
}
