import { PartialType } from '@nestjs/swagger';
import { CreateCompanyUserDto } from './create-company-user.dto';

export class UpdateCompanyUserDto extends PartialType(CreateCompanyUserDto) {}
