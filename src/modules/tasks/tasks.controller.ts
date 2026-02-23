import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { BulkUpdateStatusDto } from './dto/bulk-update-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { ValidateObjectIdPipe } from '../../common/utils/parse-mongo.utils';
import { UserId } from '../../common/decorators/user-id.decorator';

@ApiTags('Tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
    constructor(private readonly tasksService: TasksService) { }

    @Post()
    @ResponseMessage('Task created successfully')
    create(@Body() createTaskDto: CreateTaskDto) {
        return this.tasksService.create(createTaskDto);
    }

    @Patch('bulk-status-update')
    @ResponseMessage('Tasks updated successfully')
    bulkUpdateStatus(@Body() bulkUpdateStatusDto: BulkUpdateStatusDto, @UserId() user: {
        userId:string,
        email:string,
        name:string,
        role:string
    }) {
        return this.tasksService.bulkUpdateStatus(
            bulkUpdateStatusDto.ids,
            bulkUpdateStatusDto.isCompleted,
            user.userId,
        );
    }
    @Get()
    @ResponseMessage('Tasks retrieved successfully')
    findAll(@Query() query: QueryTaskDto) {
        return this.tasksService.findAll(query);
    }

    @Get(':id')
    @ResponseMessage('Task retrieved successfully')
    findOne(@Param('id', new ValidateObjectIdPipe('Task ID')) id: string) {
        return this.tasksService.findOne(id);
    }

    @Patch(':id')
    @ResponseMessage('Task updated successfully')
    update(
        @Param('id', new ValidateObjectIdPipe('Task ID')) id: string,
        @Body() updateTaskDto: UpdateTaskDto,
        @Req() req,
    ) {
        return this.tasksService.update(id, updateTaskDto, req.user.userId);
    }

    @Delete(':id')
    @ResponseMessage('Task deleted successfully')
    remove(@Param('id', new ValidateObjectIdPipe('Task ID')) id: string) {
        return this.tasksService.remove(id);
    }



    @Post(':id/toggle-status')
    @ResponseMessage('Task status toggled successfully')
    toggleStatus(@Param('id', new ValidateObjectIdPipe('Task ID')) id: string, @UserId() user:{
            userId: string;
            email: string;
            name: string;
            role: string;
        }) {
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
}
