import { Module, forwardRef } from '@nestjs/common';
import { ForeSightPdfExtractorController } from './foresight-pdf-extractor.controller';
import { ForeSightPdfExtractorService } from './foresight-pdf-extractor.service';
import { PropertiesModule } from '../properties/properties.module';
import { SuitesModule } from '../suites/suites.module';

@Module({
  imports: [PropertiesModule, forwardRef(() => SuitesModule)],
  controllers: [ForeSightPdfExtractorController],
  providers: [ForeSightPdfExtractorService],
  exports: [ForeSightPdfExtractorService],
})
export class ForeSightPdfExtractorModule {}
