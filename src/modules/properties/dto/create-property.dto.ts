import { IsEnum, IsNumber, IsString, IsOptional } from 'class-validator';
import { PropertyName } from '../enums/property-name.enum';

export class CreatePropertyDto {
  @IsString()
  propertyId: string;

  @IsEnum(PropertyName)
  propertyName: PropertyName;
}

