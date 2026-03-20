import { Test, TestingModule } from '@nestjs/testing';
import { MriTenantLedgerService } from './mri-tenant-ledger.service';
import { MriCoreService } from './mri-core.service';

describe('MriTenantLedgerService', () => {
  let service: MriTenantLedgerService;
  let mockMriCore: jest.Mocked<MriCoreService>;

  beforeEach(async () => {
    mockMriCore = {
      get: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MriTenantLedgerService,
        { provide: MriCoreService, useValue: mockMriCore },
      ],
    }).compile();

    service = module.get<MriTenantLedgerService>(MriTenantLedgerService);
  });

  describe('fetch', () => {
    it('should fetch tenant ledger records', async () => {
      const mockData = [
        {
          TransactionID: '1',
          BuildingID: '008312',
          LeaseID: '002613',
          TransactionDate: '2026-03-01',
          IncomeCategory: 'BRR',
          SourceCode: 'CH',
          CashType: 'OP',
          Description: 'Base Rent',
          TransactionAmount: 1000,
          OpenAmount: 1000,
        },
      ];

      mockMriCore.get.mockResolvedValue(mockData);

      const result = await service.fetch('008312', '002613', '2026-03-01', '2026-03-31');

      expect(result).toEqual(mockData);
      expect(mockMriCore.get).toHaveBeenCalledWith('MRI_S-PMCM_TenantLedger', {
        BLDGID: '008312',
        LEASEID: '002613',
        STARTDATE: '2026-03-01',
        ENDDATE: '2026-03-31',
        '$top': '300',
        '$skip': '0',
      });
    });

    it('should handle pagination', async () => {
      const page1 = Array(300).fill({
        TransactionID: '1',
        BuildingID: '008312',
        LeaseID: '002613',
        TransactionDate: '2026-03-01',
        TransactionAmount: 100,
        OpenAmount: 100,
      });

      const page2 = Array(50).fill({
        TransactionID: '2',
        BuildingID: '008312',
        LeaseID: '002613',
        TransactionDate: '2026-03-02',
        TransactionAmount: 200,
        OpenAmount: 200,
      });

      mockMriCore.get
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce(page2);

      const result = await service.fetch('008312', '002613');

      expect(result.length).toBe(350);
      expect(mockMriCore.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('calculateFinancials', () => {
    it('should calculate balance forward correctly', async () => {
      mockMriCore.get.mockResolvedValue([
        {
          TransactionID: '1',
          BuildingID: '008312',
          LeaseID: '002613',
          TransactionDate: '2026-02-15',
          SourceCode: 'CH',
          TransactionAmount: 1000,
          OpenAmount: 1000,
          IncomeCategory: 'BRR',
        },
        {
          TransactionID: '2',
          BuildingID: '008312',
          LeaseID: '002613',
          TransactionDate: '2026-02-20',
          SourceCode: 'CR',
          TransactionAmount: 500,
          OpenAmount: 0,
          IncomeCategory: '',
        },
      ]);

      const result = await service.calculateFinancials(
        '008312',
        '002613',
        '2026-03-01',
        '2026-03-31',
        '2026-02-28',
      );

      // Balance forward should be 1000 (charge) - 500 (receipt) = 500
      expect(result.balanceForward).toBe(500);
    });

    it('should calculate cash received correctly', async () => {
      mockMriCore.get.mockResolvedValue([
        {
          TransactionID: '3',
          BuildingID: '008312',
          LeaseID: '002613',
          TransactionDate: '2026-03-10',
          SourceCode: 'CR',
          TransactionAmount: 1500,
          OpenAmount: 0,
          IncomeCategory: '',
        },
        {
          TransactionID: '4',
          BuildingID: '008312',
          LeaseID: '002613',
          TransactionDate: '2026-03-15',
          SourceCode: 'CR',
          TransactionAmount: 500,
          OpenAmount: 0,
          IncomeCategory: '',
        },
        {
          TransactionID: '5',
          BuildingID: '008312',
          LeaseID: '002613',
          TransactionDate: '2026-02-15', // Previous month - should not count
          SourceCode: 'CR',
          TransactionAmount: 1000,
          OpenAmount: 0,
          IncomeCategory: '',
        },
      ]);

      const result = await service.calculateFinancials(
        '008312',
        '002613',
        '2026-03-01',
        '2026-03-31',
        '2026-02-28',
      );

      // Cash received should be 1500 + 500 = 2000 (not including Feb payment)
      expect(result.cashReceived).toBe(2000);
    });

    it('should calculate monthly charges by category', async () => {
      mockMriCore.get.mockResolvedValue([
        {
          TransactionID: '1',
          TransactionDate: '2026-03-01',
          SourceCode: 'CH',
          TransactionAmount: 1000,
          OpenAmount: 1000,
          IncomeCategory: 'BRR',
        },
        {
          TransactionID: '2',
          TransactionDate: '2026-03-01',
          SourceCode: 'CH',
          TransactionAmount: 200,
          OpenAmount: 200,
          IncomeCategory: 'CAM',
        },
        {
          TransactionID: '3',
          TransactionDate: '2026-03-01',
          SourceCode: 'CH',
          TransactionAmount: 100,
          OpenAmount: 100,
          IncomeCategory: 'INS',
        },
        {
          TransactionID: '4',
          TransactionDate: '2026-03-01',
          SourceCode: 'CH',
          TransactionAmount: 150,
          OpenAmount: 150,
          IncomeCategory: 'TAX',
        },
      ]);

      const result = await service.calculateFinancials(
        '008312',
        '002613',
        '2026-03-01',
        '2026-03-31',
        '2026-02-28',
      );

      expect(result.monthlyRent).toBe(1000);
      expect(result.cam).toBe(200);
      expect(result.ins).toBe(100);
      expect(result.tax).toBe(150);
    });

    it('should calculate aging buckets correctly', async () => {
      const today = new Date('2026-03-19');
      const twentyDaysAgo = new Date(today);
      twentyDaysAgo.setDate(today.getDate() - 20);
      const fortyDaysAgo = new Date(today);
      fortyDaysAgo.setDate(today.getDate() - 40);
      const seventyDaysAgo = new Date(today);
      seventyDaysAgo.setDate(today.getDate() - 70);

      mockMriCore.get.mockResolvedValue([
        {
          TransactionID: '1',
          TransactionDate: twentyDaysAgo.toISOString().split('T')[0],
          SourceCode: 'CH',
          TransactionAmount: 100,
          OpenAmount: 100,
          IncomeCategory: 'BRR',
        },
        {
          TransactionID: '2',
          TransactionDate: fortyDaysAgo.toISOString().split('T')[0],
          SourceCode: 'CH',
          TransactionAmount: 200,
          OpenAmount: 200,
          IncomeCategory: 'BRR',
        },
        {
          TransactionID: '3',
          TransactionDate: seventyDaysAgo.toISOString().split('T')[0],
          SourceCode: 'CH',
          TransactionAmount: 300,
          OpenAmount: 300,
          IncomeCategory: 'BRR',
        },
        {
          TransactionID: '4',
          TransactionDate: twentyDaysAgo.toISOString().split('T')[0],
          SourceCode: 'CH',
          TransactionAmount: 50,
          OpenAmount: 0, // Paid - should not count
          IncomeCategory: 'BRR',
        },
      ]);

      const result = await service.calculateFinancials(
        '008312',
        '002613',
        '2026-03-01',
        '2026-03-19',
        '2026-02-28',
      );

      expect(result.days0To30).toBe(100);
      expect(result.days31To60).toBe(200);
      expect(result.days61Plus).toBe(300);
      expect(result.totalArBalance).toBe(600);
    });

    it('should return zeros when no transactions found', async () => {
      mockMriCore.get.mockResolvedValue([]);

      const result = await service.calculateFinancials(
        '008312',
        '002613',
        '2026-03-01',
        '2026-03-31',
        '2026-02-28',
      );

      expect(result.balanceForward).toBe(0);
      expect(result.cashReceived).toBe(0);
      expect(result.monthlyRent).toBe(0);
      expect(result.cam).toBe(0);
      expect(result.ins).toBe(0);
      expect(result.tax).toBe(0);
      expect(result.days0To30).toBe(0);
      expect(result.days31To60).toBe(0);
      expect(result.days61Plus).toBe(0);
      expect(result.totalArBalance).toBe(0);
    });

    it('should handle multiple income categories for base rent', async () => {
      mockMriCore.get.mockResolvedValue([
        {
          TransactionID: '1',
          TransactionDate: '2026-03-01',
          SourceCode: 'CH',
          TransactionAmount: 1000,
          OpenAmount: 1000,
          IncomeCategory: 'BRR',
        },
        {
          TransactionID: '2',
          TransactionDate: '2026-03-01',
          SourceCode: 'CH',
          TransactionAmount: 500,
          OpenAmount: 500,
          IncomeCategory: 'RNT',
        },
        {
          TransactionID: '3',
          TransactionDate: '2026-03-01',
          SourceCode: 'CH',
          TransactionAmount: 300,
          OpenAmount: 300,
          IncomeCategory: 'RENT',
        },
        {
          TransactionID: '4',
          TransactionDate: '2026-03-01',
          SourceCode: 'CH',
          TransactionAmount: 200,
          OpenAmount: 200,
          IncomeCategory: 'BASE',
        },
      ]);

      const result = await service.calculateFinancials(
        '008312',
        '002613',
        '2026-03-01',
        '2026-03-31',
        '2026-02-28',
      );

      // Should sum all base rent categories
      expect(result.monthlyRent).toBe(2000);
    });
  });
});
