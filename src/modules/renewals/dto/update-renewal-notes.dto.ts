import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRenewalNotesDto {
  @ApiProperty({
    description: 'Notes for the renewal',
    example: 'Tenant requested 5-year lease extension',
    required: false,
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Notes cannot exceed 2000 characters' })
  notes?: string;
}
