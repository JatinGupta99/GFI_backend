import { IsNumber, IsOptional, IsString } from 'class-validator';

export class AccountingDetailsDto {
    @IsOptional() @IsNumber() baseRent?: number;
    @IsOptional() @IsNumber() cam?: number;
    @IsOptional() @IsNumber() ins?: number;
    @IsOptional() @IsNumber() tax?: number;
    @IsOptional() @IsNumber() totalDue?: number;
    @IsOptional() @IsNumber() balanceDue?: number;
    @IsOptional() @IsString() status?: string;
    @IsOptional() @IsString() rentDueDate?: string;
    @IsOptional() @IsString() lateAfter?: string;
    @IsOptional() @IsNumber() lateFee?: number;
}
