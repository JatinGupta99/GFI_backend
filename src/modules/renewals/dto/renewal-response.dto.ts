import { ApiProperty } from '@nestjs/swagger';

export class RenewalResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenantId: string;

  @ApiProperty()
  propertyId: string;

  @ApiProperty()
  propertyName: string;

  @ApiProperty()
  tenantName: string;

  @ApiProperty()
  suite: string;

  @ApiProperty()
  sf: number;

  @ApiProperty()
  leaseEnd: Date;

  @ApiProperty({ required: false })
  renewalOffer?: string;

  @ApiProperty()
  currentMonthRent: number;

  @ApiProperty()
  rentPerSf: number;

  @ApiProperty({ required: false })
  budgetRent?: number;

  @ApiProperty({ required: false })
  budgetRentPerSf?: number;

  @ApiProperty({ required: false })
  budgetTI?: number;

  @ApiProperty({ required: false })
  budgetLCD?: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ required: false })
  notes?: string;

  @ApiProperty({ enum: ['Yes', 'No', 'N/A'] })
  option: 'Yes' | 'No' | 'N/A';

  @ApiProperty({ required: false })
  optionTerm?: string;

  @ApiProperty()
  lastSyncAt: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class RenewalStatsDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  byStatus: Record<string, number>;

  @ApiProperty()
  byProperty: Record<string, number>;

  @ApiProperty()
  upcomingCount: number;

  @ApiProperty()
  cached: boolean;
}

export class SyncResultDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  propertiesProcessed: number;

  @ApiProperty()
  renewalsUpdated: number;

  @ApiProperty()
  renewalsCreated: number;

  @ApiProperty({ type: [String] })
  errors: string[];

  @ApiProperty()
  duration: number;

  @ApiProperty()
  timestamp: Date;
}