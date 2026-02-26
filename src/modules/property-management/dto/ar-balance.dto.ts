import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

export enum ARStatus {
    SENT_COURTESY_NOTICE = 'Sent Courtesy Notice',
    SENT_3_DAY_NOTICE = 'Sent 3-Day Notice',
    SENT_TO_ATTORNEY = 'Sent to Attorney',
    PURSUING_LEGAL_REMEDIES = 'Pursuing Legal Remedies',
    RECEIVED_PAYMENT = 'Received Payment',
    DEAD = 'Dead',
}

export enum NoticeType {
    COURTESY = 'courtesy',
    THREE_DAY = '3-day',
    ATTORNEY = 'attorney',
}

export class EmailDataDto {
    @ApiProperty({ example: 'tenant@example.com' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsOptional()
    tenantInfo: any;

    @IsString()
    @IsOptional()
    userName: string;
    @IsString()
    @IsOptional()
    userTitle: string;

    @IsString()
    @IsOptional()
    attorneyName: string;

    @IsString()
    @IsOptional()
    tenantAddress: string;

    @IsString()
    @IsOptional()
    tenantEmail: string;

    @IsString()
    @IsOptional()
    tenantPhone: string;

    @IsString()
    @IsOptional()
    currentDate?: string;

    @IsOptional()
    outstandingBalance?: number;

    @IsOptional()
    lateFee?: number;

    @IsOptional()
    totalAmount?: number;

    @IsString()
    @IsOptional()
    monthEnd?: string;

    @IsString()
    @IsOptional()
    premisesAddress?: string;

    @IsString()
    @IsOptional()
    expirationDate?: string;

    @IsString()
    @IsOptional()
    payTo?: string;

    @IsString()
    @IsOptional()
    managerName?: string;

    @IsString()
    @IsOptional()
    managerTitle?: string;

    @IsString()
    @IsOptional()
    tenantMail?: string;

    @IsString()
    @IsOptional()
    tenantContact?: string;
}

export class SendNoticeDto {

    @ApiProperty({ type: EmailDataDto })
    @ValidateNested()
    @Type(() => EmailDataDto)
    @IsNotEmpty()
    emailData: EmailDataDto;

    @ApiProperty({ example: 'Tenant promised to pay', required: false })
    @IsString()
    @IsOptional()
    note?: string;
}

export class ARBalance {
    @ApiProperty({ example: 'ar-1', description: 'Unique identifier' })
    id: string;

    @ApiProperty({ example: 'Publix Super Markets', description: 'Name of the tenant' })
    tenant: string;

    @ApiProperty({ example: 'Hamden Center', description: 'Name of the property' })
    property: string;

    @ApiProperty({ example: '101', description: 'Suite number' })
    suite: string;

    @ApiProperty({ example: 28500.00, description: 'Total outstanding amount' })
    totalARBalance: number;

    @ApiProperty({ example: 28500.00, description: 'Amount overdue by 0-30 days' })
    days0_30: number;

    @ApiProperty({ example: 0, description: 'Amount overdue by 31-60 days' })
    days31_60: number;

    @ApiProperty({ example: 0, description: 'Amount overdue by 61+ days' })
    days61_Plus: number;

    @ApiProperty({ enum: ARStatus, example: ARStatus.SENT_COURTESY_NOTICE })
    status: ARStatus;

    @ApiProperty({ example: 35000, description: 'Base monthly rent' })
    monthlyRent: number;

    @ApiProperty({ example: 38000, description: 'Total monthly due (Rent + CAM + Tax + Ins)' })
    totalMonthly: number;

    @ApiProperty({ example: '2024-02-01', description: 'Date of last notice or action', required: false })
    lastActivity?: string | Date;
}

export class ARBalanceResponse {
    @ApiProperty({ type: [ARBalance] })
    data: ARBalance[];
}
