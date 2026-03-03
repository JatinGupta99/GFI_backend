import {
  Controller,
  Post,
  Get,
  Delete,
  Put,
  Body,
  Query,
  Param,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { DocumentManagerService } from '../services/document-manager.service';
import {
  DocumentUploadUrlDto,
  DocumentDownloadOptionsDto,
  DocumentUploadUrlResult,
  DocumentDownloadUrlResult,
  DocumentInfoResult,
  DocumentListResult,
  DocumentListQueryDto,
  DocumentConfirmUploadDto,
  DocumentUpdateDto,
} from '../dto/document.dto';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Documents')
@Public()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentManager: DocumentManagerService) {}

  @Post('upload-url')
  @ApiOperation({ summary: 'Generate a pre-signed URL for direct upload to S3' })
  @ApiResponse({ status: 201, description: 'Upload URL generated successfully', type: DocumentUploadUrlResult })
  @ApiResponse({ status: 400, description: 'Invalid request or validation failed' })
  async generateUploadUrl(@Body() uploadUrlDto: DocumentUploadUrlDto): Promise<DocumentUploadUrlResult> {
    return this.documentManager.generateUploadUrl(uploadUrlDto);
  }

  @Post('confirm-upload')
  @ApiOperation({ summary: 'Confirm that a document has been successfully uploaded to S3' })
  @ApiResponse({ status: 200, description: 'Upload confirmed successfully', type: DocumentInfoResult })
  @ApiResponse({ status: 404, description: 'Document record not found' })
  async confirmUpload(@Body() confirmDto: DocumentConfirmUploadDto): Promise<DocumentInfoResult> {
    return this.documentManager.confirmUpload(confirmDto);
  }

  @Get()
  @ApiOperation({ summary: 'List documents with pagination and filtering' })
  @ApiResponse({ status: 200, description: 'Documents retrieved successfully', type: DocumentListResult })
  async listDocuments(@Query() query: DocumentListQueryDto): Promise<DocumentListResult> {
    return this.documentManager.listDocuments(query);
  }

  @Get(':key/download-url')
  @ApiOperation({ summary: 'Generate a pre-signed URL for downloading a document' })
  @ApiParam({ name: 'key', description: 'Document key' })
  @ApiQuery({ name: 'expiresIn', description: 'URL expiration in seconds', required: false })
  @ApiQuery({ name: 'inline', description: 'Display inline instead of download', required: false })
  @ApiQuery({ name: 'fileName', description: 'Custom filename', required: false })
  @ApiResponse({ status: 200, description: 'Download URL generated successfully', type: DocumentDownloadUrlResult })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async generateDownloadUrl(
    @Param('key') key: string,
    @Query() options: DocumentDownloadOptionsDto,
  ): Promise<DocumentDownloadUrlResult> {
    return this.documentManager.generateDownloadUrl(key, options);
  }

  @Get(':key/info')
  @ApiOperation({ summary: 'Get document information by key' })
  @ApiParam({ name: 'key', description: 'Document key' })
  @ApiResponse({ status: 200, description: 'Document information retrieved', type: DocumentInfoResult })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async getDocumentInfo(@Param('key') key: string): Promise<DocumentInfoResult> {
    return this.documentManager.getDocumentInfo(key);
  }

  @Get('by-id/:id')
  @ApiOperation({ summary: 'Get document information by database ID' })
  @ApiParam({ name: 'id', description: 'Document database ID' })
  @ApiResponse({ status: 200, description: 'Document information retrieved', type: DocumentInfoResult })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async getDocumentById(@Param('id') id: string): Promise<DocumentInfoResult> {
    return this.documentManager.getDocumentById(id);
  }

  @Put(':key')
  @ApiOperation({ summary: 'Update document metadata' })
  @ApiParam({ name: 'key', description: 'Document key' })
  @ApiResponse({ status: 200, description: 'Document updated successfully', type: DocumentInfoResult })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async updateDocument(
    @Param('key') key: string,
    @Body() updateDto: DocumentUpdateDto,
  ): Promise<DocumentInfoResult> {
    return this.documentManager.updateDocument(key, updateDto);
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Delete a document from both S3 and database' })
  @ApiParam({ name: 'key', description: 'Document key' })
  @ApiResponse({ status: 200, description: 'Document deleted successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async deleteDocument(@Param('key') key: string): Promise<{ message: string }> {
    await this.documentManager.deleteDocument(key);
    return { message: 'Document deleted successfully' };
  }

  @Post(':key/mark-failed')
  @ApiOperation({ summary: 'Mark a document upload as failed' })
  @ApiParam({ name: 'key', description: 'Document key' })
  @ApiResponse({ status: 200, description: 'Document marked as failed' })
  async markUploadFailed(@Param('key') key: string): Promise<{ message: string }> {
    await this.documentManager.markUploadFailed(key);
    return { message: 'Document marked as failed' };
  }

  @Post('cleanup-expired')
  @ApiOperation({ summary: 'Clean up expired pending documents' })
  @ApiResponse({ status: 200, description: 'Cleanup completed' })
  async cleanupExpiredDocuments(): Promise<{ message: string; cleanedCount: number }> {
    const cleanedCount = await this.documentManager.cleanupExpiredDocuments();
    return { 
      message: 'Cleanup completed successfully',
      cleanedCount,
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check for document service' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }
}