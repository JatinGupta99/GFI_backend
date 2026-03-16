import { ApiProperty } from '@nestjs/swagger';

export class CategoryStatsDto {
  @ApiProperty({ description: 'Count of items in this category' })
  count: number;

  @ApiProperty({ description: 'Total square footage' })
  totalSf: number;

  @ApiProperty({ description: 'Number of unique properties' })
  propertyCount: number;
}

export class AggregatedStatsDto {
  @ApiProperty({ description: 'Vacant spaces statistics', type: CategoryStatsDto })
  vacantSpaces: CategoryStatsDto;

  @ApiProperty({ description: 'LOI negotiation statistics', type: CategoryStatsDto })
  loiNegotiation: CategoryStatsDto;

  @ApiProperty({ description: 'Lease negotiation statistics', type: CategoryStatsDto })
  leaseNegotiation: CategoryStatsDto;

  @ApiProperty({ description: 'Renewals statistics', type: CategoryStatsDto })
  renewals: CategoryStatsDto;
}
