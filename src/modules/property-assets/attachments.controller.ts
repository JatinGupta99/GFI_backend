import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Delete,
    UseGuards,
    Query,
    BadRequestException,
} from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { CreateAttachmentDto, GetUploadUrlDto } from './dtos/attachment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../../common/decorators/user.decorator';
import { UserId } from '../../common/decorators/user-id.decorator';

@Controller('attachments')
@UseGuards(JwtAuthGuard)
export class AttachmentsController {
    constructor(private readonly attachmentsService: AttachmentsService) { }

    @Post('upload-url')
    getUploadUrl(@Body() dto: GetUploadUrlDto) {
        return this.attachmentsService.getUploadUrl(dto);
    }

    @Post()
    create(@Body() createAttachmentDto: CreateAttachmentDto, @User() user: any) {
        return this.attachmentsService.create(createAttachmentDto, user);
    }

    @Get('property/:id')
    findAllByProperty(@Param('id') propertyId: string) {
        return this.attachmentsService.findAllByProperty(propertyId);
    }

    @Get('download-url')
    getDownloadUrl(@Query('key') key: string) {
        if (!key) throw new BadRequestException('Key is required');
        return this.attachmentsService.getDownloadUrl(key);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.attachmentsService.remove(id);
    }
}
