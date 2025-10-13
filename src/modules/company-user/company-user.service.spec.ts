import { Test, TestingModule } from '@nestjs/testing';
import { CompanyUserService } from './company-user.service';

describe('CompanyUserService', () => {
  let service: CompanyUserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CompanyUserService],
    }).compile();

    service = module.get<CompanyUserService>(CompanyUserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
