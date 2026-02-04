import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    BadRequestException,
    Query,
} from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto, UpdateActivityDto } from './dtos/activity.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../../common/decorators/user.decorator';
import { GetUploadUrlDto } from './dtos/attachment.dto';

@Controller('activities')
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
    constructor(private readonly activitiesService: ActivitiesService) { }

    @Post()
    create(@Body() createActivityDto: CreateActivityDto) {
        return this.activitiesService.create(createActivityDto);
    }

    @Get('property/:id')
    findAllByProperty(@Param('id') propertyId: string) {
        return this.activitiesService.findAllByProperty(propertyId);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.activitiesService.findOne(id);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() updateActivityDto: UpdateActivityDto,
        @User('name') userName: string,
    ) {
        return this.activitiesService.update(id, updateActivityDto, userName);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.activitiesService.remove(id);
    }


    @Post('upload-url')
    getUploadUrl(@Body() dto: GetUploadUrlDto) {
        return this.activitiesService.getUploadUrl(dto);
    }

    @Get('download-url')
    getDownloadUrl(@Query('key') key: string) {
        if (!key) throw new BadRequestException('Key is required');
        return this.activitiesService.getDownloadUrl(key);
    }
}
