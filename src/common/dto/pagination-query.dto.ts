import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { SortOrder } from '../enums/common-enums';
export enum LeaseStatusFilter {
  LEASE_NEGOTIATION = 'LEASE_NEGOTIATION',
  OUT_FOR_EXECUTION = 'OUT_FOR_EXECUTION',
  DRAFTING_LEASE = 'DRAFTING_LEASE',
  LEASE_ALL = 'LEASE_ALL',
}
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(301)
  limit: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder: SortOrder = SortOrder.DESC;

  @IsOptional()
  @IsString()
  lead_status?: string='';

  @IsOptional()
  @IsString()
  approval_status?: string='';

  @IsOptional()
  @IsEnum(LeaseStatusFilter)
  lease_status?: LeaseStatusFilter;

  @IsOptional()
  @IsString()
  sortBy: string = 'createdAt';

  @IsOptional()
  @IsString()
  property?: string;

}