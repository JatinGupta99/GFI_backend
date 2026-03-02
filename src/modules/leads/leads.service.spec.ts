import { Test, TestingModule } from '@nestjs/testing';
import { LeadsService } from './leads.service';
import { LeadsRepository } from './repository/lead.repository';
import { MailService } from '../mail/mail.service';
import { MediaService } from '../media/media.service';
import { CompanyUserService } from '../company-user/company-user.service';
import { TasksService } from '../tasks/tasks.service';
import { getQueueToken } from '@nestjs/bullmq';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { TenantFormProgress } from './schema/tenant-form-progress.schema';
import { JOBNAME } from '../../common/enums/common-enums';

describe('LeadsService - Dashboard Metrics', () => {
  let service: LeadsService;
  let repository: LeadsRepository;

  const mockRepository = {
    aggregate: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    bulkUpdateStatus: jest.fn(),
  };

  const mockMailService = {};
  const mockMediaService = {};
  const mockCompanyUserService = {};
  const mockTasksService = {};
  const mockQueue = {};
  const mockTenantFormModel = {};
  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        {
          provide: LeadsRepository,
          useValue: mockRepository,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
        {
          provide: MediaService,
          useValue: mockMediaService,
        },
        {
          provide: CompanyUserService,
          useValue: mockCompanyUserService,
        },
        {
          provide: TasksService,
          useValue: mockTasksService,
        },
        {
          provide: getQueueToken(JOBNAME.LEADS_PROCESSING),
          useValue: mockQueue,
        },
        {
          provide: getModelToken(TenantFormProgress.name),
          useValue: mockTenantFormModel,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
    repository = module.get<LeadsRepository>(LeadsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPendingApprovals', () => {
    it('should return pending approvals count and total SF', async () => {
      const mockResult = [
        {
          _id: null,
          count: 5,
          totalSF: 12500,
        },
      ];

      mockRepository.aggregate.mockResolvedValue(mockResult);

      const result = await service.getPendingApprovals();

      expect(result).toEqual({
        count: 5,
        totalSF: 12500,
      });

      expect(mockRepository.aggregate).toHaveBeenCalledWith([
        {
          $match: {
            approval_status: { $in: ['PENDING', 'IN_REVIEW'] },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalSF: {
              $sum: {
                $convert: {
                  input: '$general.sf',
                  to: 'double',
                  onError: 0,
                  onNull: 0,
                },
              },
            },
          },
        },
      ]);
    });

    it('should return zeros when no pending approvals', async () => {
      mockRepository.aggregate.mockResolvedValue([]);

      const result = await service.getPendingApprovals();

      expect(result).toEqual({
        count: 0,
        totalSF: 0,
      });
    });
  });

  describe('getPendingApprovalsOverTwoDays', () => {
    it('should return overdue approvals count and total SF', async () => {
      const mockResult = [
        {
          _id: null,
          count: 2,
          totalSF: 5000,
        },
      ];

      mockRepository.aggregate.mockResolvedValue(mockResult);

      const result = await service.getPendingApprovalsOverTwoDays();

      expect(result).toEqual({
        count: 2,
        totalSF: 5000,
      });

      expect(mockRepository.aggregate).toHaveBeenCalled();
    });
  });

  describe('getAvgDaysToApprove', () => {
    it('should return average days to approve', async () => {
      const mockResult = [
        {
          _id: null,
          avgDays: 3.5,
        },
      ];

      mockRepository.aggregate.mockResolvedValue(mockResult);

      const result = await service.getAvgDaysToApprove();

      expect(result).toBe(4); // Rounded from 3.5
    });

    it('should return 0 when no approved deals', async () => {
      mockRepository.aggregate.mockResolvedValue([]);

      const result = await service.getAvgDaysToApprove();

      expect(result).toBe(0);
    });
  });

  describe('getApprovedDealsLast30Days', () => {
    it('should return approved deals count and total SF', async () => {
      const mockResult = [
        {
          _id: null,
          count: 8,
          totalSF: 20000,
        },
      ];

      mockRepository.aggregate.mockResolvedValue(mockResult);

      const result = await service.getApprovedDealsLast30Days();

      expect(result).toEqual({
        count: 8,
        totalSF: 20000,
      });
    });
  });

  describe('getDashboardMetrics', () => {
    it('should return all dashboard metrics', async () => {
      mockRepository.aggregate
        .mockResolvedValueOnce([{ _id: null, count: 5, totalSF: 12500 }]) // pendingApprovals
        .mockResolvedValueOnce([{ _id: null, count: 2, totalSF: 5000 }]) // pendingApprovalsOverTwoDays
        .mockResolvedValueOnce([{ _id: null, avgDays: 3 }]) // avgDaysToApprove
        .mockResolvedValueOnce([{ _id: null, count: 8, totalSF: 20000 }]); // approvedDealsLast30Days

      const result = await service.getDashboardMetrics();

      expect(result).toEqual({
        statusCode: 200,
        message: 'Dashboard metrics retrieved successfully',
        data: {
          pendingApprovals: {
            count: 5,
            totalSF: 12500,
          },
          pendingApprovalsOverTwoDays: {
            count: 2,
            totalSF: 5000,
          },
          avgDaysToApprove: 3,
          approvedDealsLast30Days: {
            count: 8,
            totalSF: 20000,
          },
        },
      });
    });

    it('should handle errors gracefully', async () => {
      mockRepository.aggregate.mockRejectedValue(new Error('Database error'));

      await expect(service.getDashboardMetrics()).rejects.toThrow(
        'Failed to fetch dashboard metrics',
      );
    });
  });
});
