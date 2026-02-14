import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { TaskPriority } from '../schema/task.schema';

export class QueryTaskDto extends PaginationQueryDto {
    @IsOptional()
    @IsString()
    property?: string;

    @ApiPropertyOptional({ enum: TaskPriority })
    @IsOptional()
    @IsEnum(TaskPriority)
    priority?: TaskPriority;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    isCompleted?: boolean;

    @ApiPropertyOptional({ description: 'Filter by owner Name' })
    @IsOptional()
    @IsString()
    ownerName?: string;
}
