import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { UserId } from '../../common/decorators/user-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ValidateObjectIdPipe } from '../../common/utils/parse-mongo.utils';
import { BulkUpdateStatusDto } from './dto/bulk-update-status.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { UpdateAttachmentsDto } from './dto/update-attachments.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@ApiTags('Tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
    constructor(private readonly tasksService: TasksService) { }

    @Post()
    @ResponseMessage('Task created successfully')
    create(
        @Body() createTaskDto: CreateTaskDto,
        @UserId() user: { userId: string; email: string; name: string; role: string }
    ) {
        return this.tasksService.create(createTaskDto, user.userId, user.name);
    }

    @Patch('bulk-status-update')
    @ResponseMessage('Tasks updated successfully')
    bulkUpdateStatus(
        @Body() bulkUpdateStatusDto: BulkUpdateStatusDto,
        @UserId() user: { userId: string; email: string; name: string; role: string }
    ) {
        return this.tasksService.bulkUpdateStatus(
            bulkUpdateStatusDto.ids,
            bulkUpdateStatusDto.isCompleted,
            user.userId,
        );
    }

    @Get()
    @ResponseMessage('Tasks retrieved successfully')
    findAll(
        @Query() query: QueryTaskDto,
        @UserId() user: { userId: string; email: string; name: string; role: string }
    ) {
        return this.tasksService.findAll(query, user.userId);
    }

    @Get(':id')
    @ResponseMessage('Task retrieved successfully')
    findOne(
        @Param('id', new ValidateObjectIdPipe('Task ID')) id: string,
        @UserId() user: { userId: string; email: string; name: string; role: string }
    ) {
        return this.tasksService.findOne(id, user.userId);
    }

    @Patch(':id')
    @ResponseMessage('Task updated successfully')
    update(
        @Param('id', new ValidateObjectIdPipe('Task ID')) id: string,
        @Body() updateTaskDto: UpdateTaskDto,
        @UserId() user: { userId: string; email: string; name: string; role: string }
    ) {
        return this.tasksService.update(id, updateTaskDto, user.userId);
    }

    @Delete(':id')
    @ResponseMessage('Task deleted successfully')
    remove(
        @Param('id', new ValidateObjectIdPipe('Task ID')) id: string,
        @UserId() user: { userId: string; email: string; name: string; role: string }
    ) {
        return this.tasksService.remove(id, user.userId);
    }

    @Post(':id/toggle-status')
    @ResponseMessage('Task status toggled successfully')
    toggleStatus(
        @Param('id', new ValidateObjectIdPipe('Task ID')) id: string,
        @UserId() user: { userId: string; email: string; name: string; role: string }
    ) {
        return this.tasksService.toggleStatus(id, user.userId);
    }

    @Post(':id/attachments/upload-url')
    @ResponseMessage('Upload URL generated successfully')
    getUploadUrl(
        @Param('id', new ValidateObjectIdPipe('Task ID')) id: string,
        @Body('contentType') contentType: string,
    ) {
        return this.tasksService.getUploadUrl(id, contentType);
    }

    @Get('attachments/download-url')
    @ResponseMessage('Download URL generated successfully')
    getAttachmentDownloadUrl(@Query('key') key: string) {
        return this.tasksService.getAttachmentDownloadUrl(key);
    }

    @Patch(':id/attachments')
    @ResponseMessage('Attachments updated successfully')
    updateAttachments(
        @Param('id', new ValidateObjectIdPipe('Task ID')) id: string,
        @Body() updateAttachmentsDto: UpdateAttachmentsDto,
        @UserId() user: { userId: string; email: string; name: string; role: string }
    ) {
        return this.tasksService.updateAttachments(id, updateAttachmentsDto.attachments, user.userId);
    }
}
