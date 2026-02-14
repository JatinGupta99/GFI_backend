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
  UseInterceptors,
  UploadedFile,
  Headers,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { SendLoiEmailDto, SendAppEmailDto, SendApprovalEmailDto, SendRenewalLetterDto } from './dto/send-email.dto';
import { LeadStatus } from '../../common/enums/common-enums';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { UserId } from '../../common/decorators/user-id.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { SaveTenantFormDto, SubmitTenantFormDto } from './dto/tenant-form.dto';

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
  @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false, transform: true }))
  create(@Body() dto: CreateLeadDto, @UserId('userId') userId: string) {
    return this.service.create(dto, userId);
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
  sendAppEmail(@Param('id') id: string, @Body() dto: SendAppEmailDto, @UserId('userId') userId: string) {
    return this.service.sendAppEmail(id, dto, userId);
  }

  @Post(':id/approval/send')
  sendApprovalEmail(@Param('id') id: string, @Body() dto: SendApprovalEmailDto) {
    return this.service.sendApprovalEmail(id, dto);
  }

  @Post(':id/renewal/letter/send')
  sendRenewalLetter(@Param('id') id: string, @Body() dto: SendRenewalLetterDto) {
    return this.service.sendRenewalLetter(id, dto);
  }

  @Post(':id/files/:fileId/process')
  processFile(@Param('id') id: string, @Param('fileId') fileId: string) {
    return this.service.processFile(id, fileId);
  }

  @Post(':id/files')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Body('category') category: string,
    @UserId('userId') userId: string,
  ) {
    return this.service.addFile(id, file, category, userId);
  }

  @Post(':id/tenant-form/send')
  sendTenantMagicLink(@Param('id') id: string, @Body('email') email?: string) {
    return this.service.sendTenantMagicLink(id, email);
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
