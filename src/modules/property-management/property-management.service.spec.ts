import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PropertyManagementService } from './property-management.service';
import { PropertiesService } from '../properties/properties.service';
import { MriLeasesService } from '../rent-roll/mri/mri-leases.service';
import { MriArService } from '../rent-roll/mri/mri-ar.service';
import { MriChargesService } from '../rent-roll/mri/mri-charges.service';
import { MailService } from '../mail/mail.service';
import { ARNoticeStatus } from './schema/ar-notice-status.schema';
import { ARStatus, NoticeType } from './dto/ar-balance.dto';

describe('PropertyManagementService', () => {
    let service: PropertyManagementService;
    let propertiesService: any;
    let leasesService: any;
    let arService: any;
    let chargesService: any;
    let noticeStatusModel: any;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PropertyManagementService,
                {
                    provide: PropertiesService,
                    useValue: {
                        findAll: jest.fn().mockResolvedValue([{ propertyId: 'prop-1' }]),
                    },
                },
                {
                    provide: MriLeasesService,
                    useValue: {
                        fetch: jest.fn().mockResolvedValue([
                            {
                                LeaseID: 'lease-1',
                                OccupantName: 'Tenant 1',
                                BuildingName: 'Building 1',
                                SuiteID: '101',
                                MasterOccupantID: 'mo-1',
                                OccupancyStatus: 'Current',
                            },
                        ]),
                    },
                },
                {
                    provide: MriArService,
                    useValue: {
                        fetch: jest.fn().mockResolvedValue([{ Balance: 1000, AgeBuckets: { Bucket1: 1000 } }]),
                    },
                },
                {
                    provide: MriChargesService,
                    useValue: {
                        fetch: jest.fn().mockResolvedValue([
                            { ChargeCode: 'RNT', Amount: 500 },
                            { ChargeCode: 'CAM', Amount: 100 },
                        ]),
                    },
                },
                {
                    provide: MailService,
                    useValue: {
                        send: jest.fn().mockResolvedValue(true),
                    },
                },
                {
                    provide: getModelToken(ARNoticeStatus.name),
                    useValue: {
                        find: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }),
                        findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) }),
                        findOneAndUpdate: jest.fn().mockResolvedValue({}),
                    },
                },
            ],
        }).compile();

        service = module.get<PropertyManagementService>(PropertyManagementService);
        propertiesService = module.get(PropertiesService);
        leasesService = module.get(MriLeasesService);
        arService = module.get(MriArService);
        chargesService = module.get(MriChargesService);
        noticeStatusModel = module.get(getModelToken(ARNoticeStatus.name));
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should aggregate AR balances correctly', async () => {
        const balances = await service.getAllARBalances();
        expect(balances).toHaveLength(1);
        expect(balances[0].totalARBalance).toBe(1000);
        expect(balances[0].monthlyRent).toBe(500);
        expect(balances[0].totalMonthly).toBe(600);
        expect(balances[0].status).toBe(ARStatus.SENT_COURTESY_NOTICE);
    });

    it('should get largest balances', async () => {
        const response = await service.getARTenants(1);
        expect(response).toHaveLength(1);
        expect(response[0].id).toBe('lease-1');
    });

    it('should calculate dashboard stats', async () => {
        const stats = await service.getDashboardStats();
        expect(stats.tenantsWithAR.count).toBe(1);
        expect(stats.tenantsWithAR.amount).toBe(1000);
        expect(stats.arByProperty).toHaveLength(1);
        expect(stats.arByProperty[0].propertyName).toBe('Building 1');
        expect(stats.arByProperty[0].balance).toBe(1000);
    });

    it('should send notice and update status', async () => {
        const dto: any = {
            emailData: {
                email: 'test@example.com',
                currentDate: 'October 13, 2025',
                outstandingBalance: 4832.31,
                lateFee: 250.00,
                totalAmount: 5082.31,
                monthEnd: 'October 31, 2025',
                premisesAddress: '15497 Stoney brook West Pkwy, #140',
                expirationDate: 'October 16, 2025',
                payTo: 'Stoneybrook West, LLC',
                managerName: 'Nick Recalt',
                managerTitle: 'Retail Property Manager'
            },
            note: 'Test note'
        };
        const result = await service.sendNotice('lease-1', NoticeType.THREE_DAY, dto);
        expect(result.success).toBe(true);
        expect(result.status).toBe(ARStatus.SENT_3_DAY_NOTICE);
        expect(noticeStatusModel.findOneAndUpdate).toHaveBeenCalled();
    });
});
