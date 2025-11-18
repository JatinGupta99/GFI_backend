import { Module } from '@nestjs/common';
import { DealStagesService } from './deal-stages.service';
import { DealStagesController } from './deal-stages.controller';

@Module({
  controllers: [DealStagesController],
  providers: [DealStagesService],
})
export class DealStagesModule {}
