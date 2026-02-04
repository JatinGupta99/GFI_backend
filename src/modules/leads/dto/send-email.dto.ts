import { IsString, IsArray, IsOptional } from 'class-validator';

export class SendLoiEmailDto {
    @IsString()
    to: string;

    @IsString()
    subject: string;

    @IsOptional()
    @IsString()
    body?: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    attachments: string[];

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    cc?: string[];
}

export class SendAppEmailDto {
    @IsString()
    to: string;

    @IsString()
    subject: string;

    @IsOptional()
    @IsString()
    body?: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    cc?: string[];

    @IsString()
    @IsOptional()
    applicationLink?: string;
}

export class SendApprovalEmailDto {
    @IsString()
    to: string;

    @IsString()
    subject: string;

    @IsOptional()
    @IsString()
    body?: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    cc?: string[];

    @IsOptional()
    payload?: any;
}
