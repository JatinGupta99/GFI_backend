import { Test, TestingModule } from '@nestjs/testing';
import { MriDataAggregatorService } from './mri-data-aggregator.service';
import { MriChargesService } from './mri-charges.service';
import { MriFinancialService } from './mri-financial.service';

describe('MriDataAggregatorService - Financial Fixes', () => {
  let service: MriDataAggregatorService;
  let chargesService: jest.Mocked<MriChargesService>;
  let financialService: jest.Mocked<MriFinancialService>;

  beforeEach(async () => {
    const mockChargesService = {
      getRecurringCharges: jest.fn(),
      getAnnualRentData: jest.fn(),
    };

    const mockFinancialService = {
      getCurrentDelinquencies: jest.fn(),
      getTenantLedger: jest.fn(),
      getOpenCharges: jest.fn(),
      getCommercialLedger: jest.fn(),
      getOpenCredits: jest.fn(),
      getLeaseBudget: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MriDataAggregatorService,
        { provide: MriChargesService, useValue: mockChargesService },
        { provide: MriFinancialService, useValue: mockFinancialService },
      ],
    }).compile();

    service = module.get<MriDataAggregatorService>(MriDataAggregatorService);
    chargesService = module.get(MriChargesService);
    financialService = module.get(MriFinancialService);
  });

  describe('Balance Due Calculation Fix', () => {
    it('should calculate balance due correctly: delinquentAmount - openCredits', async () => {
      // Arrange
      const mockDelinquencies = [{ 
        LeaseID: '123', 
        DelinquentAmount: 1000,
        ThirtyDayDelinquency: 300,
        SixtyDayDelinquency: 200,
        NinetyDayDelinquency: 500,
        NinetyPlusDayDelinquency: 0,
        PrepaidCharges: 0
      }];
      
      const mockOpenCredits = [
        { LeaseID: '123', OpenAmount: 200 },
        { LeaseID: '123', OpenAmount: 100 }
      ];

      // Mock all required service calls
      chargesService.getRecurringCharges.mockResolvedValue([]);
      chargesService.getAnnualRentData.mockResolvedValue([]);
      financialService.getCurrentDelinquencies.mockResolvedValue(mockDelinquencies);
      financialService.getTenantLedger.mockResolvedValue([]);
      financialService.getOpenCharges.mockResolvedValue([]);
      financialService.getCommercialLedger.mockResolvedValue([]);
      financialService.getOpenCredits.mockResolvedValue(mockOpenCredits);
      financialService.getLeaseBudget.mockResolvedValue([]);

      // Act
      const result = await service.aggregateLeaseData('PROP001', 'LEASE123');

      // Assert
      expect(result.balanceDue).toBe(700); // 1000 - 200 - 100 = 700
    });

    it('should not allow negative balance due', async () => {
      // Arrange
      const mockDelinquencies = [{ 
        LeaseID: '123', 
        DelinquentAmount: 100,
        ThirtyDayDelinquency: 100,
        SixtyDayDelinquency: 0,
        NinetyDayDelinquency: 0,
        NinetyPlusDayDelinquency: 0,
        PrepaidCharges: 0
      }];
      
      const mockOpenCredits = [
        { LeaseID: '123', OpenAmount: 200 } // Credit > Delinquent
      ];

      // Mock all required service calls
      chargesService.getRecurringCharges.mockResolvedValue([]);
      chargesService.getAnnualRentData.mockResolvedValue([]);
      financialService.getCurrentDelinquencies.mockResolvedValue(mockDelinquencies);
      financialService.getTenantLedger.mockResolvedValue([]);
      financialService.getOpenCharges.mockResolvedValue([]);
      financialService.getCommercialLedger.mockResolvedValue([]);
      financialService.getOpenCredits.mockResolvedValue(mockOpenCredits);
      financialService.getLeaseBudget.mockResolvedValue([]);

      // Act
      const result = await service.aggregateLeaseData('PROP001', 'LEASE123');

      // Assert
      expect(result.balanceDue).toBe(0); // Math.max(0, 100 - 200) = 0
    });
  });

  describe('Total Due Monthly Calculation Fix', () => {
    it('should sum ALL recurring monthly charges, not just 4 categories', async () => {
      // Arrange
      const mockCharges = [
        { LeaseID: '123', IncomeCategoryDescription: 'RNT', Amount: 2000, Frequency: 'M', CurrentlyInEffect: true },
        { LeaseID: '123', IncomeCategoryDescription: 'CAM', Amount: 300, Frequency: 'M', CurrentlyInEffect: true },
        { LeaseID: '123', IncomeCategoryDescription: 'INS', Amount: 150, Frequency: 'M', CurrentlyInEffect: true },
        { LeaseID: '123', IncomeCategoryDescription: 'TAX', Amount: 100, Frequency: 'M', CurrentlyInEffect: true },
        { LeaseID: '123', IncomeCategoryDescription: 'UTIL', Amount: 75, Frequency: 'M', CurrentlyInEffect: true },
        { LeaseID: '123', IncomeCategoryDescription: 'PARK', Amount: 50, Frequency: 'M', CurrentlyInEffect: true },
        { LeaseID: '123', IncomeCategoryDescription: 'MISC', Amount: 25, Frequency: 'M', CurrentlyInEffect: true },
      ];

      // Mock all required service calls
      chargesService.getRecurringCharges.mockResolvedValue(mockCharges);
      chargesService.getAnnualRentData.mockResolvedValue([]);
      financialService.getCurrentDelinquencies.mockResolvedValue([]);
      financialService.getTenantLedger.mockResolvedValue([]);
      financialService.getOpenCharges.mockResolvedValue([]);
      financialService.getCommercialLedger.mockResolvedValue([]);
      financialService.getOpenCredits.mockResolvedValue([]);
      financialService.getLeaseBudget.mockResolvedValue([]);

      // Act
      const result = await service.aggregateLeaseData('PROP001', 'LEASE123');

      // Assert
      expect(result.totalDueMonthly).toBe(2700); // Sum of ALL monthly charges
      expect(result.monthlyRent).toBe(2000);
      expect(result.cam).toBe(300);
      expect(result.ins).toBe(150);
      expect(result.tax).toBe(100);
    });
  });
});