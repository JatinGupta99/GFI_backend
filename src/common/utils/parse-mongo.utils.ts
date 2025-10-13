import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';

@Injectable()
export class ValidateObjectIdPipe implements PipeTransform<string> {
  constructor(private readonly entityName: string = 'ID') {}

  transform(value: string) {
    if (!isValidObjectId(value)) {
      throw new BadRequestException(`Invalid ${this.entityName}: ${value}`);
    }
    return value;
  }
}
