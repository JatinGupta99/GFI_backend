import { ApiProperty } from '@nestjs/swagger';

export class PropertyStatsDto {
  @ApiProperty({ description: 'Total square footage of vacant spaces' })
  vacantSpacesSf: number;

  @ApiProperty({ description: 'Total square footage in LOI negotiation' })
  loiNegotiationSf: number;

  @ApiProperty({ description: 'Total square footage in lease negotiation' })
  leaseNegotiationSf: number;

  @ApiProperty({ description: 'Total square footage in renewals' })
  renewalsSf: number;

  @ApiProperty({ description: 'Property ID' })
  propertyId: string;

  @ApiProperty({ description: 'Property name' })
  propertyName: string;
}
