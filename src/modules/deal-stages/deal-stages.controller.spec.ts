import { Test, TestingModule } from '@nestjs/testing';
import { DealStagesController } from './deal-stages.controller';
import { DealStagesService } from './deal-stages.service';

describe('DealStagesController', () => {
  let controller: DealStagesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DealStagesController],
      providers: [DealStagesService],
    }).compile();

    controller = module.get<DealStagesController>(DealStagesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
