import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { MediaEntityType } from '../../../common/enums/common-enums';
import { Type } from 'class-transformer';

export class GenerateUploadUrlDto {
  @IsNotEmpty()
  @IsString()
  fileType: string;

  @IsNotEmpty()
  @IsString()
  resourceId: string;

  @IsNotEmpty()
  @IsEnum(MediaEntityType)
  entityType: MediaEntityType;

  @IsOptional()
  @IsString()
  subResourceId?: string;

  @Type(() => Number)
  @IsOptional()
  downloadUrlExpire?: number;
}
