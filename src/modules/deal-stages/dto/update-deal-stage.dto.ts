import { PartialType } from '@nestjs/mapped-types';
import { CreateDealStageDto } from './create-deal-stage.dto';

export class UpdateDealStageDto extends PartialType(CreateDealStageDto) {}
