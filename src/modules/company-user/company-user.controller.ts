import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ValidateObjectIdPipe } from '../../common/utils/parse-mongo.utils';
import { CompanyUserService } from './company-user.service';
import { UpdateCompanyUserDto } from './dto/update-company-user.dto';
import { CreateCompanyUserDto } from './dto/create-company-user.dto';

@ApiTags('Company User')
@Controller('company-user')
@UseGuards(JwtAuthGuard)
export class CompanyUserController {
  constructor(private readonly service: CompanyUserService) {}

  @Post()
  create(@Body() dto: CreateCompanyUserDto) {
    return this.service.create(dto);
  }

  @Get('/profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req) {
    const user = await this.service.findOne(req.user.userId);
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      avatar: user.avatar || null,
    };
  }

  // @Roles(CompanyUserRole.SUPERADMIN)
  @Get()
  findAll() {
    return this.service.findAll();
  }

  // @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', new ValidateObjectIdPipe('Company User ID')) id: string) {
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
