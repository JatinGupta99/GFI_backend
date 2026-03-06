import { OmitType, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsBoolean, IsDate, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateActivityDto {
    @IsString()
    @IsNotEmpty()
    activityName: string;

    @IsString()
    @IsNotEmpty()
    department: string;

    @IsOptional()
    @IsDate()
    @Type(() => Date)
    followUpDate?: Date;

    @IsOptional()
    @IsNumber()
    isAutomatedFollowUp?: number;

    @IsOptional()
    @IsBoolean()
    followUpCompleted?: boolean;

    @IsOptional()
    @IsString()
    originalEmailSubject?: string;

    @IsOptional()
    @IsString()
    followUpType?: string;
}

export class UpdateActivityDto extends PartialType((CreateActivityDto)) {
}
