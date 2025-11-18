import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DealStagesService } from './deal-stages.service';
import { CreateDealStageDto } from './dto/create-deal-stage.dto';
import { UpdateDealStageDto } from './dto/update-deal-stage.dto';

@Controller('deal-stages')
export class DealStagesController {
  constructor(private readonly dealStagesService: DealStagesService) {}

  @Post()
  create(@Body() createDealStageDto: CreateDealStageDto) {
    return this.dealStagesService.create(createDealStageDto);
  }

  @Get()
  findAll() {
    return this.dealStagesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.dealStagesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDealStageDto: UpdateDealStageDto) {
    return this.dealStagesService.update(+id, updateDealStageDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.dealStagesService.remove(+id);
  }
}
