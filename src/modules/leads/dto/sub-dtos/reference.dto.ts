import { IsOptional, IsString } from 'class-validator';

export class ReferenceInfoDto {
    @IsOptional() @IsString() id?: string;
    @IsOptional() @IsString() type?: string;
    @IsOptional() @IsString() name?: string;
    @IsOptional() @IsString() phone?: string;
    @IsOptional() @IsString() email?: string;
    @IsOptional() @IsString() relationship?: string;
}
