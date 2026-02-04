import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { Activity } from './schemas/activity.schema';
import { CreateActivityDto, UpdateActivityDto } from './dtos/activity.dto';
import { GetUploadUrlDto } from './dtos/attachment.dto';
import { MediaService } from '../media/media.service';

@Injectable()
export class ActivitiesService {
    constructor(
        @InjectModel(Activity.name) private activityModel: Model<Activity>,
        private readonly mediaService: MediaService,
    ) { }

    async create(createActivityDto: CreateActivityDto): Promise<Activity> {
        const activity = new this.activityModel({
            ...createActivityDto,
        });
        return activity.save();
    }

    async findAllByProperty(propertyId: string): Promise<Activity[]> {
        return this.activityModel
            .find({ propertyId })
            .sort({ createdAt: -1 })
            .exec();
    }

    async findOne(id: string): Promise<Activity> {
        const activity = await this.activityModel.findById(id).exec();
        if (!activity) {
            throw new NotFoundException(`Activity with ID ${id} not found`);
        }
        return activity;
    }


    async getUploadUrl(dto: GetUploadUrlDto) {
        if (!isValidObjectId(dto.propertyId)) throw new NotFoundException('Invalid property ID');

        const ext = dto.fileName.split('.').pop() || 'bin';
        const fileId = dto.attachmentId || crypto.randomUUID();
        const fileKey = `properties/${dto.propertyId}/activities/${fileId}.${ext}`;

        const { key, url } = await this.mediaService.generateUploadUrl(
            fileKey,
            dto.contentType || `file/${ext}`,
        );
        return { key, url };
    }
    async getDownloadUrl(key: string) {
        const url = await this.mediaService.generateDownloadUrl(key);
        return {
            statusCode: 200,
            message: 'Download URL generated',
            data: { url },
        };
    }
    async update(id: string, updateActivityDto: UpdateActivityDto, userName: string): Promise<Activity> {
        const activity = await this.activityModel
            .findByIdAndUpdate(
                id,
                { ...updateActivityDto, updatedBy: userName },
                { new: true }
            )
            .exec();
        if (!activity) {
            throw new NotFoundException(`Activity with ID ${id} not found`);
        }
        return activity;
    }

    async remove(id: string) {
        const activity = await this.activityModel.findById(id).exec();
        if (!activity) {
            throw new NotFoundException(`Activity with ID ${id} not found`);
        }

        // Delete from S3 first if fileKey exists
        if (activity.fileKey) {
            this.mediaService.deleteFile(activity.fileKey);
        }

        // Then delete from Mongo
        const result = await this.activityModel.findByIdAndDelete(id).exec();
        return {
            statusCode: 200,
            message: 'Activity deleted successfully',
            data: result,
        };
    }
}
