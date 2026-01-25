import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MriService } from './mri.service';
import { CreateMriDto } from './dto/create-mri.dto';
import { UpdateMriDto } from './dto/update-mri.dto';

@Controller('mri')
export class MriController {
  constructor(private readonly mriService: MriService) {}

  @Post()
  create(@Body() createMriDto: CreateMriDto) {
    return this.mriService.create(createMriDto);
  }

  @Get()
  findAll() {
    return this.mriService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.mriService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMriDto: UpdateMriDto) {
    return this.mriService.update(+id, updateMriDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.mriService.remove(+id);
  }
}
