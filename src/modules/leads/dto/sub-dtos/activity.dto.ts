import { IsDate, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ActivityLogDto {
    @IsOptional() @IsString() id?: string;
    @IsOptional() @IsString() type?: string;
    @IsOptional() @IsString() description?: string;
    @IsOptional() @IsString() createdBy?: string;
    @IsOptional() @IsDate() @Type(() => Date) createdDate?: Date;
}
