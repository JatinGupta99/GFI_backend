import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RenewalStatus } from '../../../common/enums/common-enums';
export class UpdateRenewalStatusDto {
  @ApiProperty({
    description: 'Renewal status',
    enum: RenewalStatus,
    example: RenewalStatus.DRAFTING_AMENDMENT,
  })
  @IsEnum(RenewalStatus, {
    message: `Status must be one of: ${Object.values(RenewalStatus).join(', ')}`,
  })
  @IsString()
  status: RenewalStatus;
}
