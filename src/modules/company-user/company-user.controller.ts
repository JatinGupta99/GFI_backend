import {
  BadRequestException,
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
import { Public } from '../../common/decorators/public.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { UserId } from '../../common/decorators/user-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ValidateObjectIdPipe } from '../../common/utils/parse-mongo.utils';
import { CompanyUserService } from './company-user.service';
import { CreateCompanyUserDto } from './dto/create-company-user.dto';
import { QueryCompanyUserDto } from './dto/query-company-user.dto';
import { SignatureUploadDto } from './dto/signature-upload.dto';
import { SignatureConfirmDto } from './dto/signature-confirm.dto';
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
  @Public()
  @ResponseMessage('Upload URL generated successfully')
  getUploadUrl(
    @Param('id', new ValidateObjectIdPipe('User ID')) id: string,
    @Body('contentType') contentType: string,
  ) {
    return this.service.getUploadUrl(id, contentType);
  }

  
  @Post(':id/signature-upload-url')
  getSignatureUploadUrl(
    @Param('id', new ValidateObjectIdPipe('User ID')) id: string,
    @Body() dto: SignatureUploadDto,
    @UserId() user: { userId: string; email: string; name: string; role: string },
  ) {
    return this.service.getSignatureUploadUrl(id, dto.contentType, user.userId);
  }

  @Get(':id/signature-url')
  getSignatureDownloadUrl(
    @Param('id', new ValidateObjectIdPipe('User ID')) id: string,
    @UserId() user: { userId: string; email: string; name: string; role: string },
  ) {
    return this.service.getSignatureDownloadUrl(id, user.userId);
  }

  @Patch(':id/signature')
  @ResponseMessage('Signature updated successfully')
  updateSignature(
    @Param('id', new ValidateObjectIdPipe('User ID')) id: string,
    @Body('key') key: string,
    @UserId() user: { userId: string; email: string; name: string; role: string },
  ) {
    
    if (id !== user.userId) {
      throw new BadRequestException('Unauthorized to update signature for this user');
    }
    
    if (!key || key.trim() === '') {
      throw new BadRequestException('Signature key is required');
    }
    
    return this.service.updateSignatureKey(id, key);
  }

  @Post(':id/signature-confirm')
  @ResponseMessage('Signature confirmed and updated successfully')
  confirmSignature(
    @Param('id', new ValidateObjectIdPipe('User ID')) id: string,
    @Body() dto: SignatureConfirmDto,
    @UserId() user: { userId: string; email: string; name: string; role: string },
  ) {
    
    if (id !== user.userId) {
      throw new BadRequestException('Unauthorized to update signature for this user');
    }
    
    return this.service.confirmSignature(id, dto);
  }

}
