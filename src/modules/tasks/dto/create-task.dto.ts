import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    IsBoolean,
    IsDate,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';
import { TaskPriority } from '../schema/task.schema';

export class AttachmentDto {

    @IsString()
    @IsOptional()
    _id?: string;

    @IsString()
    @IsNotEmpty()
    key: string;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    type: string;

    @IsNumber()
    size: number;
}

export class CreateTaskDto {
    @ApiProperty({ example: 'Inspect roof leakage' })
    @IsString()
    @IsNotEmpty()
    @Transform(({ value }) => value?.trim())
    title: string;

    @ApiPropertyOptional({ example: 'Detailed description of the task' })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => value?.trim())
    description?: string;

    @IsString()
    @IsNotEmpty()
    property: string;

    @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.MEDIUM })
    @IsOptional()
    @IsEnum(TaskPriority)
    priority?: TaskPriority = TaskPriority.MEDIUM;

    @ApiPropertyOptional({ example: '2025-12-31T00:00:00.000Z' })
    @IsOptional()
    @Type(() => Date)
    @IsDate()
    dueDate?: Date;

    @ApiPropertyOptional({ type: [AttachmentDto] })
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => AttachmentDto)
    attachments?: AttachmentDto[];

    @IsString()
    @IsNotEmpty()
    ownerName: string;
}
