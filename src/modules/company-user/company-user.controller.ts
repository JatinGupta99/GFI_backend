import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ValidateObjectIdPipe } from '../../common/utils/parse-mongo.utils';
import { CompanyUserService } from './company-user.service';
import { CreateCompanyUserDto } from './dto/create-company-user.dto';
import { QueryCompanyUserDto } from './dto/query-company-user.dto';
import { UpdateCompanyUserDto } from './dto/update-company-user.dto';

@ApiTags('Company User')
@Controller('company-user')
@UseGuards(JwtAuthGuard)
export class CompanyUserController {
  constructor(private readonly service: CompanyUserService) { }

  @Post()
  @ResponseMessage('User created successfully. Setup email sent.')
  create(@Body() dto: CreateCompanyUserDto) {
    return this.service.create(dto);
  }

  @Get('/profile')
  @ResponseMessage('Profile retrieved successfully')
  getProfile(@Req() req) {
    return this.service.findOne(req.user.userId);
  }
  @Get('attachments/download-url')
  @ResponseMessage('Download URL generated successfully')
  getAttachmentDownloadUrl(@Query('key') key: string) {
    return this.service.getAttachmentDownloadUrl(key);
  }

  @Get()
  @ResponseMessage('Users retrieved successfully')
  findAll(@Query() query: QueryCompanyUserDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ResponseMessage('User retrieved successfully')
  findOne(
    @Param('id', new ValidateObjectIdPipe('Company User ID')) id: string,
  ) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ResponseMessage('User updated successfully')
  update(
    @Param('id', new ValidateObjectIdPipe('Company User ID')) id: string,
    @Body() dto: UpdateCompanyUserDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ResponseMessage('User deleted successfully')
  remove(@Param('id', new ValidateObjectIdPipe('Company User ID')) id: string) {
    return this.service.remove(id);
  }


  @Post(':id/attachments/upload-url')
  @ResponseMessage('Upload URL generated successfully')
  getUploadUrl(
    @Param('id', new ValidateObjectIdPipe('User ID')) id: string,
    @Body('contentType') contentType: string,
  ) {
    return this.service.getUploadUrl(id, contentType);
  }


}
