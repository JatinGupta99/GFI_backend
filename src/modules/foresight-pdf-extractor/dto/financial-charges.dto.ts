import { IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FinancialChargesInterface } from '../interfaces/financial-charges.interface';

export class FinancialChargesDto implements FinancialChargesInterface {
  @ApiProperty({
    description: 'Base rent amount per month',
    example: 1500.0,
  })
  @IsNumber()
  baseRentMonth: number;

  @ApiProperty({
    description: 'Common Area Maintenance (CAM) amount per month',
    example: 200.0,
  })
  @IsNumber()
  camMonth: number;

  @ApiProperty({
    description: 'Insurance recovery amount per month',
    example: 50.0,
  })
  @IsNumber()
  insMonth: number;

  @ApiProperty({
    description: 'Tax recovery amount per month',
    example: 100.0,
  })
  @IsNumber()
  taxMonth: number;

  @ApiProperty({
    description: 'Total amount due per month (sum of all charges)',
    example: 1850.0,
  })
  @IsNumber()
  totalDueMonth: number;
}
