import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SuitesService } from './suites.service';
import { SuitesController } from './suites.controller';
import { Suite, SuiteSchema } from './schema/suite.schema';
import { SuiteRepository } from './repository/suite.repository';
import { ForeSightPdfExtractorModule } from '../foresight-pdf-extractor/foresight-pdf-extractor.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Suite.name, schema: SuiteSchema }]),
    forwardRef(() => ForeSightPdfExtractorModule),
  ],
  controllers: [SuitesController],
  providers: [SuitesService, SuiteRepository],
  exports: [SuitesService, SuiteRepository],
})
export class SuitesModule {}
