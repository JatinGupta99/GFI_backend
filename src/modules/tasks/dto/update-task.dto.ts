import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTaskDto } from './create-task.dto';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
    @IsOptional()
    @IsBoolean()
    isCompleted?: boolean;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    completedAt?: Date;
}
