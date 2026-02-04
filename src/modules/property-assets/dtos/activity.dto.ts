import { OmitType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateActivityDto {
    @IsString()
    @IsNotEmpty()
    activityName: string;

    @IsString()
    @IsOptional()
    department?: string;

    @IsString()
    @IsNotEmpty()
    propertyId: string;

    @IsString()
    @IsOptional()
    fileKey?: string;

    @IsString()
    @IsNotEmpty()
    createdBy: string;
}

export class UpdateActivityDto extends OmitType(CreateActivityDto, ['createdBy']) {
    @IsNotEmpty()
    @IsString()
    lastModifiedBy: string;
}
