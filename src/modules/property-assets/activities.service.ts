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

    async create(leadId:string,createActivityDto: CreateActivityDto,user:any): Promise<Activity> {
        const activity = new this.activityModel({
            createdBy:user.userId,
            leadId:leadId,
            ...createActivityDto,
        });
        return activity.save();
    }

    async findAllByLead(leadId: string, page: number = 1, limit: number = 10) {
        const skip = (page - 1) * limit;
        
        const [data, total] = await Promise.all([
            this.activityModel
                .find({ leadId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .exec(),
            this.activityModel.countDocuments({ leadId }).exec(),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
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


    async getUploadUrl(leadId:string,activityId:string,contentType:string) {
        if (!isValidObjectId(leadId)) throw new NotFoundException('Invalid lead ID');
        const fileKey = `leads/${leadId}/activities/${activityId}`;

        const { key, url } = await this.mediaService.generateUploadUrl(
            fileKey,
            contentType ,
        );
        return { key, url };
    }
    async getDownloadUrl(activityId:string,key: string) {
        const url = await this.mediaService.generateDownloadUrl(key);
        return {
            statusCode: 200,
            message: 'Download URL generated',
            data: { url ,activityId},
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
