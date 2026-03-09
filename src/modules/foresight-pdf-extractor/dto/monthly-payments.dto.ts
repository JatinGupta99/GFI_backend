import { IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MonthlyPaymentsInterface } from '../interfaces/monthly-payments.interface';

export class MonthlyPaymentsDto implements MonthlyPaymentsInterface {
  @ApiProperty({ description: 'January payment', example: 1850.0 })
  @IsNumber()
  jan: number;

  @ApiProperty({ description: 'February payment', example: 1850.0 })
  @IsNumber()
  feb: number;

  @ApiProperty({ description: 'March payment', example: 1850.0 })
  @IsNumber()
  mar: number;

  @ApiProperty({ description: 'April payment', example: 1850.0 })
  @IsNumber()
  apr: number;

  @ApiProperty({ description: 'May payment', example: 1850.0 })
  @IsNumber()
  may: number;

  @ApiProperty({ description: 'June payment', example: 1850.0 })
  @IsNumber()
  jun: number;

  @ApiProperty({ description: 'July payment', example: 1850.0 })
  @IsNumber()
  jul: number;

  @ApiProperty({ description: 'August payment', example: 1850.0 })
  @IsNumber()
  aug: number;

  @ApiProperty({ description: 'September payment', example: 1850.0 })
  @IsNumber()
  sept: number;

  @ApiProperty({ description: 'October payment', example: 1850.0 })
  @IsNumber()
  oct: number;

  @ApiProperty({ description: 'November payment', example: 1850.0 })
  @IsNumber()
  nov: number;

  @ApiProperty({ description: 'December payment', example: 1850.0 })
  @IsNumber()
  dec: number;
}
