import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentsModule } from './documents.module';
import { DocumentManagerService } from './services/document-manager.service';

describe('DocumentsModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
        }),
        MongooseModule.forRoot('mongodb://localhost:27017/test'),
        DocumentsModule,
      ],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide DocumentManagerService', () => {
    const service = module.get<DocumentManagerService>(DocumentManagerService);
    expect(service).toBeDefined();
  });

  afterEach(async () => {
    await module.close();
  });
});