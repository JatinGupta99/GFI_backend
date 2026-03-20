import { IsString, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { SuiteDataInterface } from '../interfaces/suite-data.interface';
import { FinancialChargesDto } from './financial-charges.dto';
import { LeaseTermsDto } from './lease-terms.dto';
import { MonthlyPaymentsDto } from './monthly-payments.dto';

export class SuiteDataDto implements SuiteDataInterface {
  @ApiProperty({
    description: 'Suite identifier',
    example: '001',
  })
  @IsString()
  suiteId: string;

  @ApiProperty({
    description: 'Financial charges for the suite',
    type: FinancialChargesDto,
  })
  @ValidateNested()
  @Type(() => FinancialChargesDto)
  charges: FinancialChargesDto;

  @ApiProperty({
    description: 'Balance due amount',
    example: 0,
  })
  @IsNumber()
  balanceDue: number;

  @ApiProperty({
    description: 'Lease terms for the suite',
    type: LeaseTermsDto,
  })
  @ValidateNested()
  @Type(() => LeaseTermsDto)
  leaseTerms: LeaseTermsDto;

  @ApiProperty({
    description: 'Monthly payment amounts for all 12 months',
    type: MonthlyPaymentsDto,
  })
  @ValidateNested()
  @Type(() => MonthlyPaymentsDto)
  monthlyPayments: MonthlyPaymentsDto;
}
