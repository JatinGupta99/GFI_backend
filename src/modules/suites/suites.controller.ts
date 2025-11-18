import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SuitesService } from './suites.service';
import { CreateSuiteDto } from './dto/create-suite.dto';
import { UpdateSuiteDto } from './dto/update-suite.dto';

@Controller('suites')
export class SuitesController {
  constructor(private readonly suitesService: SuitesService) {}

  @Post()
  create(@Body() createSuiteDto: CreateSuiteDto) {
    return this.suitesService.create(createSuiteDto);
  }

  @Get()
  findAll() {
    return this.suitesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.suitesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSuiteDto: UpdateSuiteDto) {
    return this.suitesService.update(+id, updateSuiteDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.suitesService.remove(+id);
  }
}
