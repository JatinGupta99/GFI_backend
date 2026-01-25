import { Test, TestingModule } from '@nestjs/testing';
import { MriService } from './mri.service';

describe('MriService', () => {
  let service: MriService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MriService],
    }).compile();

    service = module.get<MriService>(MriService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
