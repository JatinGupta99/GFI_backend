import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LeaseTermsInterface } from '../interfaces/lease-terms.interface';

export class LeaseTermsDto implements LeaseTermsInterface {
  @ApiProperty({
    description: 'Rent due date',
    example: '2024-01-01',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  rentDueDate: string | null;

  @ApiProperty({
    description: 'Late after date',
    example: '2024-01-05',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  lateAfter: string | null;

  @ApiProperty({
    description: 'Late fee amount',
    example: 50.0,
  })
  @IsNumber()
  lateFee: number;
}
