import { Injectable } from '@nestjs/common';
import { CreateSuiteDto } from './dto/create-suite.dto';
import { UpdateSuiteDto } from './dto/update-suite.dto';

@Injectable()
export class SuitesService {
  create(createSuiteDto: CreateSuiteDto) {
    return 'This action adds a new suite';
  }

  findAll() {
    return `This action returns all suites`;
  }

  findOne(id: number) {
    return `This action returns a #${id} suite`;
  }

  update(id: number, updateSuiteDto: UpdateSuiteDto) {
    return `This action updates a #${id} suite`;
  }

  remove(id: number) {
    return `This action removes a #${id} suite`;
  }
}
