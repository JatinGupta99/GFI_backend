import { PartialType } from '@nestjs/mapped-types';
import { CreateMriDto } from './create-mri.dto';

export class UpdateMriDto extends PartialType(CreateMriDto) {}
