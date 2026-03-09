import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SuitesService } from './suites.service';
import { SuitesController } from './suites.controller';
import { Suite, SuiteSchema } from './schema/suite.schema';
import { SuiteRepository } from './repository/suite.repository';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Suite.name, schema: SuiteSchema }]),
  ],
  controllers: [SuitesController],
  providers: [SuitesService, SuiteRepository],
  exports: [SuitesService, SuiteRepository],
})
export class SuitesModule {}
