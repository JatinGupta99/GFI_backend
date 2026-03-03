import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentsController } from './controllers/documents.controller';
import { DocumentManagerService } from './services/document-manager.service';
import { S3DocumentStorageService } from './services/s3-document-storage.service';
import { DocumentValidatorService } from './services/document-validator.service';
import { DocumentRepository } from './repository/document.repository';
import { DocumentEntity, DocumentSchema } from './schema/document.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DocumentEntity.name, schema: DocumentSchema },
    ]),
  ],
  controllers: [DocumentsController],
  providers: [
    S3DocumentStorageService,
    DocumentValidatorService,
    DocumentRepository,
    DocumentManagerService,
  ],
  exports: [
    DocumentManagerService,
    DocumentRepository,
    S3DocumentStorageService,
    DocumentValidatorService,
  ],
})
export class DocumentsModule {}