import { Test, TestingModule } from '@nestjs/testing';
import { DealStagesService } from './deal-stages.service';

describe('DealStagesService', () => {
  let service: DealStagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DealStagesService],
    }).compile();

    service = module.get<DealStagesService>(DealStagesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
