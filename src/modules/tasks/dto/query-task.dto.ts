import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PropertyList } from '../../../common/enums/common-enums';
import { TaskPriority } from '../schema/task.schema';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryTaskDto extends PaginationQueryDto {
    @ApiPropertyOptional({ enum: PropertyList })
    @IsOptional()
    @IsEnum(PropertyList)
    property?: PropertyList;

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
