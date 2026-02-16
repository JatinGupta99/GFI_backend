import { IsString, IsArray, IsOptional, IsObject } from 'class-validator';

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
    body?: string | {
        loggedin_name?: string;
        loggedin_role?: string;
        loggedin_co_name?: string;
        formBody?: any;
    };

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    cc?: string[];

    @IsOptional()
    payload?: any;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    items?: string[];
}

export class SendRenewalLetterDto {
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
    attachments?: string[];

    @IsOptional()
    @IsString({ each: true })
    cc?: string[];

    @IsOptional()
    followUpDays?: number;

    @IsOptional()
    addFollowUpTask?: boolean;
}

export class SendTenantMagicLinkDto {
    @IsOptional()
    @IsString()
    email?: string;
    @IsOptional()
    @IsString({ each: true })
    cc?: string[];

    @IsOptional()
    @IsString()
    subject?: string;

    @IsOptional()
    body?: string | any;
}
