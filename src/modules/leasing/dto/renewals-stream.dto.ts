import { IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class RenewalsStreamQueryDto {
    @ApiProperty({ 
        example: 2, 
        description: 'Number of properties to process per batch',
        required: false,
        default: 2
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    batchSize?: number = 2;

    @ApiProperty({ 
        example: 300000, 
        description: 'Delay between batches in milliseconds (default: 5 minutes)',
        required: false,
        default: 300000
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    delayMs?: number = 300000; // 5 minutes default
}

export interface RenewalsBatchResponse {
    type: 'batch' | 'complete' | 'error';
    batchNumber?: number;
    totalBatches?: number;
    propertiesProcessed?: string[];
    renewalsCount?: number;
    data?: any[];
    totalRenewals?: number;
    error?: string;
    progress?: {
        current: number;
        total: number;
        percentage: number;
    };
}
