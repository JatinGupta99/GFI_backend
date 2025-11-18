import { Test, TestingModule } from '@nestjs/testing';
import { SuitesService } from './suites.service';

describe('SuitesService', () => {
  let service: SuitesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SuitesService],
    }).compile();

    service = module.get<SuitesService>(SuitesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
