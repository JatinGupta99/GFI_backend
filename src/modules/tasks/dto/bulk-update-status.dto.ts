import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNotEmpty } from 'class-validator';

export class BulkUpdateStatusDto {
    @ApiProperty({ example: ['60d5ecb5f1b2c3d4e5f6g7h8'] })
    @IsArray()
    @IsNotEmpty()
    ids: string[];

    @ApiProperty({ example: true })
    @IsBoolean()
    isCompleted: boolean;
}
