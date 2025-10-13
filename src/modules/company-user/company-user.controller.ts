import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CompanyUserService } from './company-user.service';
import { CreateCompanyUserDto } from './dto/create-company-user.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateCompanyUserDto } from './dto/update-company-user.dto';
import { ValidateObjectIdPipe } from '../../common/utils/parse-mongo.utils';

@ApiTags('Company User')
@Controller('company-user')
export class CompanyUserController {
  constructor(private readonly service: CompanyUserService) {}

  @Post()
  @ApiOperation({ summary: 'Create new company user' })
  create(@Body() dto: CreateCompanyUserDto) {
    return this.service.create(dto);
  }

  // @Roles(CompanyUserRole.SUPERADMIN)
  @Get()
  findAll() {
    return this.service.findAll();
  }

  // @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(
    @Param('id', new ValidateObjectIdPipe('Company User ID')) id: string,
  ) {
    return this.service.findOne(id);
  }

  // @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id', new ValidateObjectIdPipe('Company User ID')) id: string,
    @Body() dto: UpdateCompanyUserDto,
  ) {
    return this.service.update(id, dto);
  }

  // @UseGuards(JwtAuthGuard, RoleGuard)
  // @Roles(CompanyUserRole.SUPERADMIN)
  @Delete(':id')
  remove(@Param('id', new ValidateObjectIdPipe('Company User ID')) id: string) {
    return this.service.remove(id);
  }
}
