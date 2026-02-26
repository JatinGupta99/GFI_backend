import {
  Controller,
  Get,
  Param,
  Query,
  Post,
  Body,
  Patch,
  Delete,
  UsePipes,
  ValidationPipe,
  Headers,
} from '@nestjs/common';

import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { SendLoiEmailDto, SendAppEmailDto, SendApprovalEmailDto, SendRenewalLetterDto, SendTenantMagicLinkDto } from './dto/send-email.dto';
import { LeadStatus } from '../../common/enums/common-enums';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LeaseQueryDto } from './dto/lease-query.dto';
import { UserId } from '../../common/decorators/user-id.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { SaveTenantFormDto, SubmitTenantFormDto } from './dto/tenant-form.dto';
import { User } from '../../common/decorators/user.decorator';

@Controller('leasing/active-leads')
export class LeadsController {
  constructor(private readonly service: LeadsService) { }

  @Get()
  @UsePipes(new ValidationPipe({ transform: true }))
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get('leases')
  @UsePipes(new ValidationPipe({ transform: true }))
  findAllLeases(@Query() query: LeaseQueryDto) {
    return this.service.findAllLeases(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false, transform: true }))
  create(@Body() dto: CreateLeadDto, @UserId() user:{
            userId: string;
            email: string;
            name: string;
            role: string;
        }) {
    return this.service.create(dto, user.userId);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false, transform: true }))
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

  @Get(':id/loi/generate')
  generateLoi(@Param('id') id: string) {
    return this.service.generateLoi(id);
  }

  @Get(':id/loi/attachments')
  getLoiAttachments(@Param('id') id: string) {
    return this.service.getLoiAttachments(id);
  }

  @Post(':id/loi/send')
  sendLoiEmail(@Param('id') id: string, @Body() dto: SendLoiEmailDto) {
    return this.service.sendLoiEmail(id, dto);
  }

  @Post(':id/app/send')
  sendAppEmail(@Param('id') id: string, @Body() dto: SendAppEmailDto, @UserId() user: {
            userId: string;
            email: string;
            name: string;
            role: string;
        }) {
    return this.service.sendAppEmail(id, dto, user.userId);
  }

  @Post(':id/approval/send')
  sendApprovalEmail(@Param('id') id: string, @Body() dto: SendApprovalEmailDto, @User() user: {
    userId: string;
    name: string;
    role: string;
    email: string;
  }) {
    return this.service.sendApprovalEmail(id, dto, user);
  }

  @Post(':id/renewal/letter/send')
  sendRenewalLetter(@Param('id') id: string, @Body() dto: SendRenewalLetterDto) {
    return this.service.sendRenewalLetter(id, dto);
  }

  @Post(':id/files/:fileId/process')
  processFile(@Param('id') id: string, @Param('fileId') fileId: string) {
    return this.service.processFile(id, fileId);
  }

  @Post(':id/files/upload-url')
  getFileUploadUrl(
    @Param('id') id: string,
    @Body('contentType') contentType: string,
    @Body('category') category: string,
  ) {
    return this.service.getFileUploadUrl(id, contentType, category);
  }

  @Post(':id/files/confirm')
  confirmFileUpload(
    @Param('id') id: string,
    @Body('key') key: string,
    @Body('fileName') fileName: string,
    @Body('fileSize') fileSize: number,
    @Body('fileType') fileType: string,
    @Body('category') category: string,
    @UserId() user: {
      userId: string;
      email: string;
      name: string;
      role: string;
    },
  ) {
    return this.service.confirmFileUpload(id, key, fileName, fileSize, fileType, category, user.name);
  }

  @Delete(':id/files')
  deleteFile(
    @Param('id') id: string,
    @Query('fileKey') fileKey: string,
  ) {
    return this.service.deleteFile(id, fileKey);
  }

  @Get('files/download-url')
  getFileDownloadUrl(@Query('key') key: string) {
    return this.service.getFileDownloadUrl(key);
  }


  @Post(':id/tenant-form/send')
  sendTenantMagicLink(@Param('id') id: string, @Body() dto: SendTenantMagicLinkDto) {
    return this.service.sendTenantMagicLink(id, dto);
  }

  @Public()
  @Get('public/tenant-form')
  getTenantForm(@Headers('authorization') auth: string) {
    const token = auth?.replace('Bearer ', '');
    return this.service.getTenantForm(token);
  }

  @Public()
  @Post('public/tenant-form/save')
  saveTenantForm(@Headers('authorization') auth: string, @Body() dto: SaveTenantFormDto) {
    const token = auth?.replace('Bearer ', '');
    return this.service.saveTenantForm(token, dto);
  }

  @Public()
  @Post('public/tenant-form/submit')
  submitTenantForm(@Headers('authorization') auth: string, @Body() dto: SubmitTenantFormDto) {
    const token = auth?.replace('Bearer ', '');
    return this.service.submitTenantForm(token, dto);
  }
}
