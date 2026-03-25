import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FinancialChargesInterface } from '../interfaces/financial-charges.interface';

export class FinancialChargesDto implements FinancialChargesInterface {
  @ApiProperty({
    description: 'Base rent amount per month',
    example: '1500.00',
  })
  @IsString()
  baseRentMonth: string;

  @ApiProperty({
    description: 'Common Area Maintenance (CAM) amount per month',
    example: '200.00',
  })
  @IsString()
  camMonth: string;

  @ApiProperty({
    description: 'Insurance recovery amount per month',
    example: '50.00',
  })
  @IsString()
  insMonth: string;

  @ApiProperty({
    description: 'Tax recovery amount per month',
    example: '100.00',
  })
  @IsString()
  taxMonth: string;

  @ApiProperty({
    description: 'Total amount due per month (sum of all charges)',
    example: '1850.00',
  })
  @IsString()
  totalDueMonth: string;
}
