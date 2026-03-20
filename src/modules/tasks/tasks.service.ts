import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as crypto from 'crypto';
import { isValidObjectId, Model, Types } from 'mongoose';
import { MediaService } from '../media/media.service';
import { Property, PropertyDocument } from '../properties/schema/property.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task, TaskDocument } from './schema/task.schema';

@Injectable()
export class TasksService {
    constructor(
        @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
        @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
        private readonly mediaService: MediaService,
    ) { }

    async create(createTaskDto: CreateTaskDto, userId: string, userName: string): Promise<any> {
        // Look up property by propertyId to get propertyName
        const property = await this.propertyModel.findOne({ propertyId: createTaskDto.property }).exec();
        if (!property) {
            throw new NotFoundException(`Property with ID ${createTaskDto.property} not found`);
        }

        const task = new this.taskModel({
            ...createTaskDto,
            property: property.propertyName, // Save propertyName instead of propertyId
            userId,
            ownerName: userName,
        });
        const savedTask = await task.save();
        
        return this.wrapTaskWithSignedUrls(savedTask);
    }

    private async wrapTaskWithSignedUrls(task: any) {
        // Handle both Mongoose documents and plain objects from aggregation
        const taskObj = task.toObject ? task.toObject() : task;
        
        if (taskObj.attachments?.length) {
            taskObj.attachments = await Promise.all(
                taskObj.attachments.map(async (att) => ({
                    ...att,
                    url: (await this.mediaService.generateDownloadUrl(att.key)).toString(),
                })),
            );
        }
        return taskObj;
    }

    async findAll(query: QueryTaskDto, userId: string) {
        const { search, property, priority, isCompleted, ownerName, page = 1, limit = 10 } = query;
        const filter: any = { userId: new Types.ObjectId(userId) }; // Filter by logged-in user

        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
            ];
        }
        if (property) filter.property = property;
        if (priority) filter.priority = priority;
        if (isCompleted !== undefined) filter.isCompleted = isCompleted;
        if (ownerName) filter.ownerName = { $regex: ownerName, $options: 'i' };

        const skip = (page - 1) * limit;

        const [tasks, total] = await Promise.all([
            this.taskModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
            this.taskModel.countDocuments(filter),
        ]);

        // Generate signed URLs for attachments
        const tasksWithSignedUrls = await Promise.all(
            tasks.map(async (task) => this.wrapTaskWithSignedUrls(task)),
        );

        return {
            data: tasksWithSignedUrls,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }

    async findOne(id: string, userId: string): Promise<any> {
        if (!isValidObjectId(id)) throw new NotFoundException('Invalid task ID');
        
        const task = await this.taskModel.findOne({ _id: id, userId }).exec();
        if (!task) throw new NotFoundException('Task not found');

        return this.wrapTaskWithSignedUrls(task);
    }

    async update(id: string, updateTaskDto: UpdateTaskDto, userId: string): Promise<any> {
        if (!isValidObjectId(id)) throw new NotFoundException('Invalid task ID');

        // Handle completion logic if isCompleted is explicitly set
        if (updateTaskDto.isCompleted === true) {
            updateTaskDto.completedAt = new Date();
        } else if (updateTaskDto.isCompleted === false) {
            // @ts-ignore
            updateTaskDto.completedAt = null;
            // @ts-ignore
            updateTaskDto.completedBy = null;
        }

        // Merge completedBy if completed
        const updateData: any = { ...updateTaskDto };
        if (updateTaskDto.isCompleted) {
            updateData.completedBy = userId;
        }

        const task = await this.taskModel
            .findOneAndUpdate({ _id: id, userId }, updateData, { new: true })
            .exec();

        if (!task) throw new NotFoundException('Task not found');
        return this.wrapTaskWithSignedUrls(task);
    }

    async remove(id: string, userId: string): Promise<void> {
        if (!isValidObjectId(id)) throw new NotFoundException('Invalid task ID');
        const result = await this.taskModel.findOneAndDelete({ _id: id, userId }).exec();
        if (!result) throw new NotFoundException('Task not found');
    }

    async getUploadUrl(taskId: string, contentType: string) {
        if (!isValidObjectId(taskId)) throw new NotFoundException('Invalid task ID');

        const ext = contentType.split('/')[1] || 'bin';
        const fileId = crypto.randomUUID();
        const fileKey = `tasks/${taskId}/${fileId}.${ext}`;

        const { key, url } = await this.mediaService.generateUploadUrl(fileKey, contentType);

        return {
            statusCode: 200,
            message: 'Signed URL generated',
            data: {
                key,
                url,
            },
        };
    }

    async getAttachmentDownloadUrl(key: string) {
        const url = await this.mediaService.generateDownloadUrl(key);
        return {
            statusCode: 200,
            message: 'Download URL generated',
            data: { url },
        };
    }

    async bulkUpdateStatus(ids: string[], isCompleted: boolean, userId: string): Promise<any> {
        const validIds = ids.filter(id => isValidObjectId(id));
        if (validIds.length === 0) return { modifiedCount: 0 };

        const updateData: any = { isCompleted };
        if (isCompleted) {
            updateData.completedAt = new Date();
            updateData.completedBy = userId;
        } else {
            updateData.completedAt = null;
            updateData.completedBy = null;
        }

        const result = await this.taskModel.updateMany(
            { _id: { $in: validIds }, userId }, // Only update user's own tasks
            { $set: updateData }
        ).exec();

        return result;
    }

    async toggleStatus(id: string, userId: string): Promise<Task | null> {
        if (!isValidObjectId(id)) throw new NotFoundException('Invalid task ID');
        const task = await this.taskModel.findOne({ _id: id, userId }).exec();
        if (!task) throw new NotFoundException('Task not found');

        const newStatus = !task.isCompleted;
        const updateData: any = { isCompleted: newStatus };

        if (newStatus) {
            updateData.completedAt = new Date();
            updateData.completedBy = userId;
        } else {
            updateData.completedAt = null;
            updateData.completedBy = null;
        }

        const updatedTask = await this.taskModel
            .findOneAndUpdate({ _id: id, userId }, { $set: updateData }, { new: true })
            .exec();

        if (!updatedTask) throw new NotFoundException('Task not found');
        return this.wrapTaskWithSignedUrls(updatedTask);
    }

    async updateAttachments(id: string, attachments: any[], userId: string): Promise<any> {
        if (!isValidObjectId(id)) throw new NotFoundException('Invalid task ID');

        const task = await this.taskModel
            .findOneAndUpdate(
                { _id: id, userId },
                { $set: { attachments } },
                { new: true }
            )
            .exec();

        if (!task) throw new NotFoundException('Task not found');
        return this.wrapTaskWithSignedUrls(task);
    }
}
