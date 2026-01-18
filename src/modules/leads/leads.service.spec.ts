import { Test, TestingModule } from '@nestjs/testing';
import { LeadsService } from './leads.service';
import { LeadsRepository } from './repository/lead.repository';

describe('LeadsService', () => {
  let service: LeadsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        {
          provide: LeadsRepository,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
