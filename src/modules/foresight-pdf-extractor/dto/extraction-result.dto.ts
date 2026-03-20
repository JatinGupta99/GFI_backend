import { IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { SuiteDataDto } from './suite-data.dto';

export class ExtractionResultDto {
  @ApiProperty({
    description: 'Property identifier',
    example: '123456',
  })
  @IsString()
  propertyId: string;

  @ApiProperty({
    description: 'Property name',
    example: 'Downtown Plaza',
  })
  @IsString()
  propertyName: string;

  @ApiProperty({
    description: 'Region code',
    example: 'CA',
  })
  @IsString()
  region: string;

  @ApiProperty({
    description: 'Array of suite data',
    type: [SuiteDataDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SuiteDataDto)
  suites: SuiteDataDto[];

  @ApiProperty({
    description: 'Timestamp when the extraction was created (ISO 8601 format)',
    example: '2024-01-15T10:30:00.000Z',
  })
  @IsString()
  createdAt: string;

  @ApiProperty({
    description: 'Timestamp when the extraction was last updated (ISO 8601 format)',
    example: '2024-01-15T10:30:00.000Z',
  })
  @IsString()
  updatedAt: string;

  @ApiProperty({
    description: 'Array of extraction log entries describing how values were extracted',
    type: [String],
    example: ['PDF parsed successfully', 'Property ID extracted: 123456'],
  })
  @IsArray()
  extractionLogs: string[];
}
