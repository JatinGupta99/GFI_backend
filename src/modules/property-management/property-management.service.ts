import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PropertiesService } from '../properties/properties.service';
import { MriLeasesService } from '../rent-roll/mri/mri-leases.service';
import { MriArService } from '../rent-roll/mri/mri-ar.service';
import { MriChargesService } from '../rent-roll/mri/mri-charges.service';
import { ARBalance, ARStatus, NoticeType, SendNoticeDto } from './dto/ar-balance.dto';
import { ARNoticeStatus, ARNoticeStatusDocument } from './schema/ar-notice-status.schema';
import { MailService } from '../mail/mail.service';
import { EmailType } from '../../common/enums/common-enums';

@Injectable()
export class PropertyManagementService {
    private readonly logger = new Logger(PropertyManagementService.name);

    constructor(
        private readonly propertiesService: PropertiesService,
        private readonly leasesService: MriLeasesService,
        private readonly arService: MriArService,
        private readonly chargesService: MriChargesService,
        private readonly mailService: MailService,
        @InjectModel(ARNoticeStatus.name) private noticeStatusModel: Model<ARNoticeStatusDocument>,
    ) { }

    async getAllARBalances(): Promise<ARBalance[]> {
        const properties = await this.propertiesService.findAll();
        const allBalances: ARBalance[] = [];

        for (const property of properties) {
            const balances = await this.getARBalancesByProperty(property.propertyId);
            allBalances.push(...balances);
        }

        return allBalances;
    }

    async getARTenants(limit: number): Promise<ARBalance[]> {
        const allBalances = await this.getAllARBalances();
        return allBalances
            .sort((a, b) => b.totalARBalance - a.totalARBalance)
            .slice(0, limit);
    }

    async getDashboardStats() {
        const balances = await this.getAllARBalances();

        const tenantsWithAR = balances.filter(b => b.totalARBalance > 0);
        const tenantsWith3Day = balances.filter(b => b.status === ARStatus.SENT_3_DAY_NOTICE);
        const tenantsWithAttorney = balances.filter(b => b.status === ARStatus.SENT_TO_ATTORNEY);
        const negotiatingSettlement = balances.filter(b => b.status === ARStatus.PURSUING_LEGAL_REMEDIES);

        const arByPropertyMap = new Map<string, number>();
        balances.forEach(b => {
            const current = arByPropertyMap.get(b.property) || 0;
            arByPropertyMap.set(b.property, current + b.totalARBalance);
        });

        const arByProperty = Array.from(arByPropertyMap.entries()).map(([propertyName, balance]) => ({
            propertyName,
            balance
        }));

        return {
            tenantsWithAR: {
                count: tenantsWithAR.length,
                amount: tenantsWithAR.reduce((sum, b) => sum + b.totalARBalance, 0)
            },
            tenantsWith3Day: {
                count: tenantsWith3Day.length,
                amount: tenantsWith3Day.reduce((sum, b) => sum + b.totalARBalance, 0)
            },
            tenantsWithAttorney: {
                count: tenantsWithAttorney.length,
                amount: tenantsWithAttorney.reduce((sum, b) => sum + b.totalARBalance, 0)
            },
            negotiatingSettlement: {
                count: negotiatingSettlement.length,
                amount: negotiatingSettlement.reduce((sum, b) => sum + b.totalARBalance, 0)
            },
            arByProperty
        };
    }

    async sendNotice(id: string, type: NoticeType, dto: SendNoticeDto) {
        // Re-mapping logic
        const statusMapping: Record<string, ARStatus> = {
            [NoticeType.COURTESY]: ARStatus.SENT_COURTESY_NOTICE,
            [NoticeType.THREE_DAY]: ARStatus.SENT_3_DAY_NOTICE,
            [NoticeType.ATTORNEY]: ARStatus.SENT_TO_ATTORNEY,
        };

        const emailMapping: Record<string, EmailType> = {
            [NoticeType.COURTESY]: EmailType.COURTESY,
            [NoticeType.THREE_DAY]: EmailType.THREE_DAY,
            [NoticeType.ATTORNEY]: EmailType.ATTORNEY,
        };

        const newStatus = statusMapping[type];
        const targetEmailType = emailMapping[type];
        const { emailData, note } = dto;

        // Logic to trigger notice workflow
        this.logger.log(`Sending ${type} notice for lease ${id}`);

        if (emailData && emailData.email) {
            try {
                await this.mailService.send(targetEmailType, {
                    ...emailData,
                    firstName: emailData.tenantInfo?.tenant.split(' ')[0] || 'Tenant',
                    tenantName: emailData.tenantInfo?.tenant || 'Tenant',
                    propertyName: emailData.tenantInfo?.property || 'the Property',
                    userName: emailData.userName,
                    userTitle: emailData.userTitle,
                    subject: `${emailData.tenantInfo?.tenant || ''} at ${emailData.tenantInfo?.property || ''} (${type.charAt(0).toUpperCase() + type.slice(1)} Notice)`,
                    attorneyName: emailData.attorneyName,
                    tenantFullName: emailData.tenantInfo?.tenant,
                    tenantCompanyName: emailData.tenantInfo?.tenant,
                    tenantAddress: emailData.tenantAddress || '',
                    tenantEmail: emailData.tenantEmail || '',
                    tenantPhone: emailData.tenantPhone || '',
                    tenantMail: emailData.tenantMail || emailData.tenantEmail || '',
                    tenantContact: emailData.tenantContact || emailData.tenantPhone || '',
                    currentDate: emailData.currentDate || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
                    outstandingBalance: emailData.outstandingBalance || 0,
                    lateFee: emailData.lateFee || 0,
                    totalAmount: emailData.totalAmount || (Number(emailData.outstandingBalance || 0) + Number(emailData.lateFee || 0)),
                    monthEnd: emailData.monthEnd || '',
                    premisesAddress: emailData.premisesAddress || emailData.tenantInfo?.property || '',
                    expirationDate: emailData.expirationDate || '',
                    payTo: emailData.payTo || emailData.tenantInfo?.property || '',
                    managerName: emailData.managerName || emailData.userName || '',
                    managerTitle: emailData.managerTitle || emailData.userTitle || '',
                });
            } catch (error) {
                this.logger.error(`Failed to send email: ${error.message}`);
            }
        }

        await this.noticeStatusModel.findOneAndUpdate(
            { leaseId: id },
            {
                status: newStatus,
                lastActivity: new Date(),
                note: note || ''
            },
            { upsert: true, new: true }
        );

        return { success: true, status: newStatus };
    }

    private async getARBalancesByProperty(propertyId: string): Promise<ARBalance[]> {
        const leases = await this.leasesService.fetch(propertyId);
        const currentLeases = leases.filter(l => l.OccupancyStatus?.toUpperCase() === 'CURRENT' || !l.OccupancyStatus);

        const balances: ARBalance[] = [];
        const CHUNK_SIZE = 5;

        for (let i = 0; i < currentLeases.length; i += CHUNK_SIZE) {
            const chunk = currentLeases.slice(i, i + CHUNK_SIZE);
            const chunkResults = await Promise.all(chunk.map(async (lease) => {
                const [arRaw, charges, localStatus] = await Promise.all([
                    this.safeFetch(() => this.arService.fetch(lease.MasterOccupantID), []),
                    this.safeFetch(() => this.chargesService.fetch(lease.LeaseID), []),
                    this.noticeStatusModel.findOne({ leaseId: lease.LeaseID }).lean().exec()
                ]);

                const totalARBalance = arRaw.reduce((sum, item) => sum + (item.Balance || 0), 0);

                // Simplified bucket logic - in real scenario, we'd need more data to bucket accurately
                // For now, we'll assign the total to 0-30 day bucket as a default if not specified
                // unless we have specific bucket info in arRaw
                const days0_30 = arRaw.reduce((sum, item) => sum + (item.AgeBuckets?.Bucket1 || item.Balance || 0), 0);
                const days31_60 = arRaw.reduce((sum, item) => sum + (item.AgeBuckets?.Bucket2 || 0), 0);
                const days61_Plus = arRaw.reduce((sum, item) => sum + (item.AgeBuckets?.Bucket3 || item.AgeBuckets?.Bucket4 || 0), 0);

                const monthlyRentCharges = charges.filter(c => ['RNT', 'RENT', 'BASE'].includes(c.ChargeCode?.toUpperCase()));
                const allMonthlyCharges = charges.filter(c => ['RNT', 'RENT', 'BASE', 'CAM', 'TAX', 'INS'].includes(c.ChargeCode?.toUpperCase()));

                const monthlyRent = monthlyRentCharges.reduce((sum, c) => sum + (c.Amount || 0), 0);
                const totalMonthly = allMonthlyCharges.reduce((sum, c) => sum + (c.Amount || 0), 0);

                const arBalance: ARBalance = {
                    id: lease.LeaseID,
                    tenant: lease.OccupantName,
                    property: lease.BuildingName,
                    suite: lease.SuiteID,
                    totalARBalance: Number(totalARBalance.toFixed(2)),
                    days0_30: Number(days0_30.toFixed(2)),
                    days31_60: Number(days31_60.toFixed(2)),
                    days61_Plus: Number(days61_Plus.toFixed(2)),
                    status: (localStatus?.status as ARStatus) || ARStatus.SENT_COURTESY_NOTICE,
                    monthlyRent: Number(monthlyRent.toFixed(2)),
                    totalMonthly: Number(totalMonthly.toFixed(2)),
                    lastActivity: localStatus?.lastActivity,
                    note: localStatus?.note
                };

                return arBalance;
            }));

            balances.push(...chunkResults);

            if (i + CHUNK_SIZE < currentLeases.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        return balances;
    }

    private async safeFetch<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
        try {
            return await fn();
        } catch (error) {
            this.logger.error(`safeFetch() failed: ${error.message}`);
            return fallback;
        }
    }
}
