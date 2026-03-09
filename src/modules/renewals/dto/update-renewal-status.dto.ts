import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum RenewalStatus {
  RENEWAL_NEGOTIATION = 'Renewal Negotiation',
  DRAFTING_AMENDMENT = 'Drafting Amendment',
  NO_CONTACT = 'No Contact',
  RENEWED = 'Renewed',
  OUT_FOR_EXECUTION = 'Out for Execution',
  EXPIRED = 'Expired',
  SEND_COURTESY_NOTICE="SEND_COURTESY_NOTICE",
  SEND_THREE_DAY_NOTICE = 'SEND_THREE_DAY_NOTICE',
}

export class UpdateRenewalStatusDto {
  @ApiProperty({
    description: 'Renewal status',
    enum: RenewalStatus,
    example: RenewalStatus.RENEWED,
  })
  @IsEnum(RenewalStatus, {
    message: `Status must be one of: ${Object.values(RenewalStatus).join(', ')}`,
  })
  @IsString()
  status: RenewalStatus;
}
