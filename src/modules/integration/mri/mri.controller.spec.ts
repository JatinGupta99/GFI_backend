import { Test, TestingModule } from '@nestjs/testing';
import { MriController } from './mri.controller';
import { MriService } from './mri.service';

describe('MriController', () => {
  let controller: MriController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MriController],
      providers: [MriService],
    }).compile();

    controller = module.get<MriController>(MriController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
