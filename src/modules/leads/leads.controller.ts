import {
  Controller,
  Get,
  Param,
  Query,
  Post,
  Body,
  Patch,
  Delete,
} from '@nestjs/common';

import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadStatus } from '../../common/enums/common-enums';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { UserId } from '../../common/decorators/user-id.decorator copy';

@Controller('leasing/active-leads')
export class LeadsController {
  constructor(private readonly service: LeadsService) { }

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateLeadDto, @UserId() userId: string) {
    return this.service.create(dto, userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('bulk/status')
  bulkStatus(@Body() body: { ids: string[]; status: LeadStatus }) {
    return this.service.bulkUpdateStatus(body.ids, body.status);
  }
}
