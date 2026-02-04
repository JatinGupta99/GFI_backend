import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { Attachment } from './schemas/attachment.schema';
import { CreateAttachmentDto, GetUploadUrlDto } from './dtos/attachment.dto';
import { MediaService } from '../media/media.service';
import { CompanyUserService } from '../company-user/company-user.service';

@Injectable()
export class AttachmentsService {
    private readonly logger = new Logger(AttachmentsService.name);
    constructor(
        @InjectModel(Attachment.name) private attachmentModel: Model<Attachment>,
        private readonly mediaService: MediaService,
        private readonly companyUserService: CompanyUserService,
    ) { }

    async getUploadUrl(dto: GetUploadUrlDto) {
        if (!isValidObjectId(dto.propertyId)) throw new NotFoundException('Invalid property ID');

        const ext = dto.fileName.split('.').pop() || 'bin';
        const fileId = dto.attachmentId || crypto.randomUUID();
        const fileKey = `properties/${dto.propertyId}/attachments/${fileId}.${ext}`;

        const { key, url } = await this.mediaService.generateUploadUrl(
            fileKey,
            dto.contentType || `file/${ext}`,
        );
        return { key, url };
    }

    async create(createAttachmentDto: CreateAttachmentDto, user: any): Promise<Attachment> {
        this.logger.log(user, 'cnsalkncsla');
        const attachment = new this.attachmentModel({
            ...createAttachmentDto,
        });
        return attachment.save();
    }

    async findAllByProperty(propertyId: string): Promise<any[]> {
        return await this.attachmentModel
            .find({ propertyId })
            .sort({ createdAt: -1 })
            .lean()
            .exec();
    }

    async getDownloadUrl(key: string) {
        const url = await this.mediaService.generateDownloadUrl(key);
        return {
            statusCode: 200,
            message: 'Download URL generated',
            data: { url },
        };
    }

    async remove(id: string) {
        const attachment = await this.attachmentModel.findById(id).exec();
        if (!attachment) {
            throw new NotFoundException(`Attachment with ID ${id} not found`);
        }

        // Delete from S3 first
        this.mediaService.deleteFile(attachment.fileKey);

        // Then delete from Mongo
        const result = await this.attachmentModel.findByIdAndDelete(id).exec();
        return {
            statusCode: 200,
            message: 'Attachment deleted successfully',
            data: result,
        };
    }
}
