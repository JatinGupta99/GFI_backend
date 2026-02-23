import { OmitType, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateActivityDto {
    @IsString()
    @IsNotEmpty()
    activityName: string;

    @IsString()
    @IsNotEmpty()
    department: string;
}

export class UpdateActivityDto extends PartialType((CreateActivityDto)) {
}
