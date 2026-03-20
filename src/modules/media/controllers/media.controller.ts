import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { MediaService } from '../media.service';
import { GenerateUploadUrlDto } from '../dtos/generate-upload-url.dto';

@Controller('media')
export class MediaController {
  constructor(private mediaService: MediaService) { }

  @Post('upload-url')
  async getUploadUrl(@Body() dto: GenerateUploadUrlDto) {
    const { fileType, resourceId, entityType, subResourceId, downloadUrlExpire } = dto;
    const folderPath = `${entityType}/${resourceId}/${subResourceId || 'temp'}`;
    return this.mediaService.generateUploadUrl(folderPath, fileType, undefined, downloadUrlExpire);
  }

  @Get('download-url')
  async getDownloadUrl(@Query('key') key: string) {
    const url = await this.mediaService.generateDownloadUrl(key);
    return { url };
  }
}
