import { Injectable } from '@nestjs/common';
import { CreateDealStageDto } from './dto/create-deal-stage.dto';
import { UpdateDealStageDto } from './dto/update-deal-stage.dto';

@Injectable()
export class DealStagesService {
  create(createDealStageDto: CreateDealStageDto) {
    return 'This action adds a new dealStage';
  }

  findAll() {
    return `This action returns all dealStages`;
  }

  findOne(id: number) {
    return `This action returns a #${id} dealStage`;
  }

  update(id: number, updateDealStageDto: UpdateDealStageDto) {
    return `This action updates a #${id} dealStage`;
  }

  remove(id: number) {
    return `This action removes a #${id} dealStage`;
  }
}
