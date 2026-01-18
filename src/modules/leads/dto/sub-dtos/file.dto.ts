import { IsDate, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class FileInfoDto {
    @IsOptional() @IsString() id?: string;
    @IsOptional() @IsString() fileName?: string;
    @IsOptional() @IsString() uploadedBy?: string;
    @IsOptional() @IsDate() @Type(() => Date) uploadedDate?: Date;
    @IsOptional() @IsNumber() fileSize?: number;
    @IsOptional() @IsString() fileType?: string;
    @IsOptional() @IsString() category?: string;
}
