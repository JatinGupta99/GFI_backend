import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmailType, LeadStatus } from '../../common/enums/common-enums';
import { LeadsRepository } from '../leads/repository/lead.repository';
import { MailService } from '../mail/mail.service';
import { MediaService } from '../media/media.service';
import { PropertiesService } from '../properties/properties.service';
import { MriArService } from '../rent-roll/mri/mri-ar.service';
import { MriChargesService } from '../rent-roll/mri/mri-charges.service';
import { MriLeasesService } from '../rent-roll/mri/mri-leases.service';
import { TaskPriority } from '../tasks/schema/task.schema';
import { TasksService } from '../tasks/tasks.service';
import { ARBalance, ARStatus, NoticeType, SendNoticeDto } from './dto/ar-balance.dto';
import { ARNoticeStatus, ARNoticeStatusDocument } from './schema/ar-notice-status.schema';

@Injectable()
export class PropertyManagementService {
    private readonly logger = new Logger(PropertyManagementService.name);

    constructor(
        private readonly propertiesService: PropertiesService,
        private readonly leasesService: MriLeasesService,
        private readonly arService: MriArService,
        private readonly chargesService: MriChargesService,
        private readonly mailService: MailService,
        private readonly mediaService: MediaService,
        private readonly tasksService: TasksService,
        @InjectModel(ARNoticeStatus.name) private noticeStatusModel: Model<ARNoticeStatusDocument>,
        private readonly leadsRepository: LeadsRepository,
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

    async sendNotice(id: string, type: NoticeType, dto: SendNoticeDto,user: { userId: string; email: string; name: string; role: string }) {
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

        const leadStatusMapping: Record<string, LeadStatus> = {
            [NoticeType.COURTESY]: LeadStatus.SEND_COURTESY_NOTICE,
            [NoticeType.THREE_DAY]: LeadStatus.SEND_THREE_DAY_NOTICE,
            [NoticeType.ATTORNEY]: LeadStatus.SEND_ATTORNEY_NOTICE,
        };

        const newStatus = statusMapping[type];
        const targetEmailType = emailMapping[type];
        const newLeadStatus = leadStatusMapping[type];
        const { emailData, note, attachments, cc, followUpDays } = dto;

        // Logic to trigger notice workflow
        this.logger.log(`Sending ${type} notice for lease ${id}`);
        this.logger.log(`CC recipients: ${JSON.stringify(cc || [])}`);
        this.logger.log(`Attachments: ${JSON.stringify(attachments || [])}`);
        this.logger.log(`Follow-up days: ${followUpDays || 'None'}`);

        // Resolve attachments from S3 keys to file buffers
        const resolvedAttachments: any[] = [];
        if (attachments && attachments.length > 0) {
            for (const fileKey of attachments) {
                try {
                    // Extract filename from the S3 key (last part of the path)
                    const filename = fileKey.split('/').pop() || 'attachment.pdf';
                    
                    // Download file buffer from S3
                    const fileBuffer = await this.mediaService.getFileBuffer(fileKey);
                    
                    // Format for nodemailer
                    resolvedAttachments.push({
                        filename,
                        content: fileBuffer,
                        contentType: 'application/pdf',
                    });
                    
                    this.logger.log(`Resolved attachment: ${fileKey} -> ${filename}`);
                } catch (error) {
                    this.logger.error(`Failed to resolve attachment ${fileKey}: ${error.message}`);
                    // Continue with other attachments even if one fails
                }
            }
        }

        if (emailData && emailData.email) {
            try {
                const emailPayload = {
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
                    // Use values from emailData if provided, otherwise default to 0
                    outstandingBalance: emailData.outstandingBalance ?? emailData.balance ?? 0,
                    lateFee: emailData.lateFee ?? 0,
                    totalAmount: emailData.totalAmount ?? ((emailData.outstandingBalance ?? emailData.balance ?? 0) + (emailData.lateFee ?? 0)),
                    monthEnd: emailData.monthEnd || '',
                    premisesAddress: emailData.premisesAddress || emailData.propertyAddress || emailData.tenantInfo?.property || '',
                    expirationDate: emailData.expirationDate || '',
                    payTo: emailData.payTo || emailData.tenantInfo?.property || '',
                    managerName: emailData.managerName || emailData.userName || '',
                    managerTitle: emailData.managerTitle || emailData.userTitle || '',
                    // Include additional fields from emailData
                    balance: emailData.balance ?? 0,
                    monthlyRent: emailData.monthlyRent ?? 0,
                    cam: emailData.cam ?? 0,
                    ins: emailData.ins ?? 0,
                    tax: emailData.tax ?? 0,
                    totalMonthly: emailData.totalMonthly ?? 0,
                    suite: emailData.suite || '',
                    propertyAddress: emailData.propertyAddress || '',
                    cc: cc || [],
                    attachments: resolvedAttachments,
                };
                
                this.logger.log(`Email payload CC: ${JSON.stringify(emailPayload.cc)}`);
                this.logger.log(`Email payload attachments count: ${emailPayload.attachments.length}`);
                this.logger.log(`Email payload balance: ${emailPayload.balance}, lateFee: ${emailPayload.lateFee}`);
                
                await this.mailService.send(targetEmailType, emailPayload);
            } catch (error) {
                this.logger.error(`Failed to send email: ${error.message}`);
            }
        }

        // Update AR notice status
        await this.noticeStatusModel.findOneAndUpdate(
            { leaseId: id },
            {
                status: newStatus,
                lastActivity: new Date(),
                note: note || ''
            },
            { upsert: true, new: true }
        );

        // Update Lead status
        try {
            await this.leadsRepository.update(id, { lead_status: newLeadStatus });
            this.logger.log(`Updated lead ${id} status to ${newLeadStatus}`);
        } catch (error) {
            this.logger.warn(`Failed to update lead status: ${error.message}`);
        }

        // Create follow-up task if requested
        if (followUpDays && followUpDays > 0) {
            try {
                const followUpDate = new Date();
                followUpDate.setDate(followUpDate.getDate() + followUpDays);

                const tenantName = emailData.tenantInfo?.tenant || 'Tenant';
                const propertyName = emailData.tenantInfo?.property || 'Property';
                const noticeTypeLabel = type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ');

                await this.tasksService.create({
                    title: `Follow up: ${noticeTypeLabel} Notice - ${tenantName}`,
                    description: `Follow up on ${noticeTypeLabel} notice sent to ${tenantName} at ${propertyName}. Lead ID: ${id}`,
                    dueDate: followUpDate,
                    property: propertyName,
                    priority: TaskPriority.MEDIUM,
                } ,
                user.userId,
                user.name
            );

                this.logger.log(`Created follow-up task for ${followUpDays} days from now`);
            } catch (error) {
                this.logger.error(`Failed to create follow-up task: ${error.message}`);
            }
        }

        return { success: true, status: newLeadStatus };
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
                    this.safeFetch(() => this.chargesService.fetch(lease.LeaseID, propertyId), []),
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
                    lastActivity: localStatus?.lastActivity
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
