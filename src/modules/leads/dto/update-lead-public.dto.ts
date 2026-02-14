import { IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateLeadDto } from './create-lead.dto'; // Reusing parts of create/update DTO if possible or defining partials
import { FormStatus } from '../../../common/enums/common-enums';

// We can reuse existing DTOs or define minimal versions if validation rules differ for public side
// For now, assuming we want to allow updating the same structures as CreateLeadDto but optional

export class UpdateLeadPublicDto {
    @IsNotEmpty()
    @IsString()
    tenant_token: string;

    @IsOptional()
    @IsEnum(FormStatus)
    status?: FormStatus;

    // We can treat the sections as flexible objects or typed DTOs.
    // Given the requirement to match curl structure:

    @IsOptional()
    business?: any;

    @IsOptional()
    financial?: any;

    @IsOptional()
    references?: any;

    @IsOptional()
    general?: any;
}
