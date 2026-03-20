import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsRepository } from './repository/lead.repository';
import { UpdateLeadPublicDto } from './dto/update-lead-public.dto';

describe('Tenant Application Submission Prevention', () => {
  let service: LeadsService;
  let repository: LeadsRepository;

  const mockLead = {
    _id: '507f1f77bcf86cd799439011',
    general: {
      firstName: 'John',
      lastName: 'Doe',
      applicationSubmitted: false,
      applicationSubmittedAt: null,
    },
    business: {},
    financial: {},
    references: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSubmittedLead = {
    ...mockLead,
    general: {
      ...mockLead.general,
      applicationSubmitted: true,
      applicationSubmittedAt: new Date('2024-03-03T10:00:00Z'),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        {
          provide: LeadsRepository,
          useValue: {
            findById: jest.fn(),
            update: jest.fn(),
          },
        },
        // Mock other dependencies
        {
          provide: 'MailService',
          useValue: {},
        },
        {
          provide: 'MediaService',
          useValue: {},
        },
        {
          provide: 'CompanyUserService',
          useValue: {},
        },
        {
          provide: 'TasksService',
          useValue: {},
        },
        {
          provide: 'BullQueue_LEADS_PROCESSING',
          useValue: {},
        },
        {
          provide: 'TenantFormProgressModel',
          useValue: {},
        },
        {
          provide: 'ConfigService',
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
    repository = module.get<LeadsRepository>(LeadsRepository);
  });

  describe('updateLeadPublic', () => {
    it('should allow first submission', async () => {
      const leadId = '507f1f77bcf86cd799439011';
      const submissionData: UpdateLeadPublicDto = {
        general: {
          name: 'John Doe',
          applicationSubmitted: true,
        },
      };

      jest.spyOn(repository, 'findById').mockResolvedValue(mockLead as any);
      jest.spyOn(repository, 'update').mockResolvedValue({
        ...mockLead,
        general: {
          ...mockLead.general,
          firstName: 'John',
          lastName: 'Doe',
          applicationSubmitted: true,
          applicationSubmittedAt: new Date(),
        },
      } as any);

      const result = await service.updateLeadPublic(leadId, submissionData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Application submitted successfully');
      expect(result.data.applicationSubmitted).toBe(true);
      expect(result.data.applicationSubmittedAt).toBeDefined();
    });

    it('should prevent duplicate submission', async () => {
      const leadId = '507f1f77bcf86cd799439011';
      const submissionData: UpdateLeadPublicDto = {
        general: {
          name: 'John Doe',
          applicationSubmitted: true,
        },
      };

      jest.spyOn(repository, 'findById').mockResolvedValue(mockSubmittedLead as any);

      await expect(service.updateLeadPublic(leadId, submissionData)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateLeadPublic(leadId, submissionData)).rejects.toThrow(
        'Application has already been submitted and cannot be modified',
      );
    });

    it('should prevent any updates after submission', async () => {
      const leadId = '507f1f77bcf86cd799439011';
      const updateData: UpdateLeadPublicDto = {
        business: {
          legalName: 'Updated Business Name',
        },
      };

      jest.spyOn(repository, 'findById').mockResolvedValue(mockSubmittedLead as any);

      await expect(service.updateLeadPublic(leadId, updateData)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow updates before submission', async () => {
      const leadId = '507f1f77bcf86cd799439011';
      const updateData: UpdateLeadPublicDto = {
        business: {
          legalName: 'Updated Business Name',
        },
      };

      jest.spyOn(repository, 'findById').mockResolvedValue(mockLead as any);
      jest.spyOn(repository, 'update').mockResolvedValue({
        ...mockLead,
        business: { legalName: 'Updated Business Name' },
      } as any);

      const result = await service.updateLeadPublic(leadId, updateData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Lead updated successfully');
    });
  });

  describe('getSubmissionStatus', () => {
    it('should return correct status for unsubmitted application', async () => {
      const leadId = '507f1f77bcf86cd799439011';

      jest.spyOn(repository, 'findById').mockResolvedValue(mockLead as any);

      const result = await service.getSubmissionStatus(leadId);

      expect(result.success).toBe(true);
      expect(result.data.isSubmitted).toBe(false);
      expect(result.data.canModify).toBe(true);
      expect(result.data.submittedAt).toBeNull();
    });

    it('should return correct status for submitted application', async () => {
      const leadId = '507f1f77bcf86cd799439011';

      jest.spyOn(repository, 'findById').mockResolvedValue(mockSubmittedLead as any);

      const result = await service.getSubmissionStatus(leadId);

      expect(result.success).toBe(true);
      expect(result.data.isSubmitted).toBe(true);
      expect(result.data.canModify).toBe(false);
      expect(result.data.submittedAt).toBe('2024-03-03T10:00:00.000Z');
    });
  });

  describe('findOnePublic', () => {
    it('should return lead data with submission status', async () => {
      const leadId = '507f1f77bcf86cd799439011';

      jest.spyOn(repository, 'findById').mockResolvedValue(mockSubmittedLead as any);

      const result = await service.findOnePublic(leadId);

      expect(result.success).toBe(true);
      expect(result.data.general.applicationSubmitted).toBe(true);
      expect(result.data.general.applicationSubmittedAt).toBe('2024-03-03T10:00:00.000Z');
    });

    it('should throw NotFoundException for invalid lead ID', async () => {
      const leadId = '507f1f77bcf86cd799439011';

      jest.spyOn(repository, 'findById').mockResolvedValue(null);

      await expect(service.findOnePublic(leadId)).rejects.toThrow(NotFoundException);
    });
  });
});