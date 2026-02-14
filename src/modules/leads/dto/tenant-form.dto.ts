import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class SaveTenantFormDto {
    @IsNotEmpty()
    @IsObject()
    form_data: any;
}

export class SubmitTenantFormDto {
    @IsNotEmpty()
    @IsObject()
    form_data: any;
}

export class TenantTokenDto {
    @IsNotEmpty()
    @IsString()
    token: string;
}
