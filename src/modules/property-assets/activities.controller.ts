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
import { UserId } from '../../common/decorators/user-id.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Controller('leasing/active-leads/:id/activities')
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
    constructor(private readonly activitiesService: ActivitiesService) { }

    @Post()
    create(
        @Param('id') leadId: string,
        @Body() createActivityDto: CreateActivityDto,
        @UserId() user: {
            userId: string;
            email: string;
            name: string;
            role: string;
        }
    ) {
        console.log(user, 'clnascknsca')
        return this.activitiesService.create(leadId, createActivityDto, user);
    }

    @Get()
    async findAllByLead(
        @Param('id') leadId: string,
        @Query() query: PaginationQueryDto
    ) {
        const { page = 1, limit = 10 } = query;
        return this.activitiesService.findAllByLead(leadId, page, limit);
    }

    @Get('property/:propertyId')
    findAllByProperty(@Param('propertyId') propertyId: string) {
        return this.activitiesService.findAllByProperty(propertyId);
    }

    @Get(':activityId')
    findOne(@Param('activityId') activityId: string) {
        return this.activitiesService.findOne(activityId);
    }

    @Patch(':activityId')
    update(
        @Param('activityId') activityId: string,
        @Body() updateActivityDto: UpdateActivityDto,
        @User() user: { userId: string; email: string; name: string; role: string; },
    ) {
        return this.activitiesService.update(activityId, updateActivityDto, user.name);
    }

    @Delete(':activityId')
    remove(@Param('activityId') activityId: string) {
        return this.activitiesService.remove(activityId);
    }

    @Post(':activityId/upload-url')
    getUploadUrl(@Param(':id')leadId:string,@Param('activityId')activityId:string,@Body() contentType:string) {
        return this.activitiesService.getUploadUrl(leadId,activityId,contentType);
    }

    @Get(':activityId/download-url')
    getDownloadUrl(@Param('activityId') activityId:string,@Query('key') key: string) {
        if (!key) throw new BadRequestException('Key is required');
        if (!activityId) throw new BadRequestException('activityId is required');
        return this.activitiesService.getDownloadUrl(activityId,key);
    }
}
