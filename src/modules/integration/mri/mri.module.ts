import { Module } from '@nestjs/common';
import { MriService } from './mri.service';
import { MriController } from './mri.controller';

@Module({
  controllers: [MriController],
  providers: [MriService],
})
export class MriModule {}
