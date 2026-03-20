import { Injectable } from '@nestjs/common';
import { CreateMriDto } from './dto/create-mri.dto';
import { UpdateMriDto } from './dto/update-mri.dto';

@Injectable()
export class MriService {
  create(createMriDto: CreateMriDto) {
    return 'This action adds a new mri';
  }

  findAll() {
    return `This action returns all mri`;
  }

  findOne(id: number) {
    return `This action returns a #${id} mri`;
  }

  update(id: number, updateMriDto: UpdateMriDto) {
    return `This action updates a #${id} mri`;
  }

  remove(id: number) {
    return `This action removes a #${id} mri`;
  }
}
