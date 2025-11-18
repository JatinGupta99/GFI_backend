import { Test, TestingModule } from '@nestjs/testing';
import { SuitesController } from './suites.controller';
import { SuitesService } from './suites.service';

describe('SuitesController', () => {
  let controller: SuitesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SuitesController],
      providers: [SuitesService],
    }).compile();

    controller = module.get<SuitesController>(SuitesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
