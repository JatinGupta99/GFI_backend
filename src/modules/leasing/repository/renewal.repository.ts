import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Renewal, RenewalDocument } from '../../renewals/renewal.entity';
import { UpcomingRenewal } from '../dto/upcoming-renewal.dto';
import { SuiteRepository } from '../../suites/repository/suite.repository';

@Injectable()
export class RenewalRepository {
    private readonly logger = new Logger(RenewalRepository.name);

    constructor(
        @InjectModel(Renewal.name) private renewalModel: Model<RenewalDocument>,
        private readonly suiteRepository: SuiteRepository,
    ) {}

    /**
     * Sync renewals data from API response
     * Upserts renewals and marks old ones as inactive
     */
    async syncRenewals(renewals: UpcomingRenewal[], syncJobId: string, propertyName?: string): Promise<{
        created: number;
        updated: number;
        deactivated: number;
    }> {
        this.logger.log(`Starting sync of ${renewals.length} renewals with job ID: ${syncJobId}`);
        
        let created = 0;
        let updated = 0;

        // Get current active renewal mriLeaseIds to track which ones to deactivate
        const currentActiveIds = await this.renewalModel
            .find({})
            .distinct('mriLeaseId');

        const syncedIds = new Set<string>();

        // Upsert each renewal
        for (const renewal of renewals) {
            syncedIds.add(renewal.id);
            
            const existingRenewal = await this.renewalModel.findOne({
                mriLeaseId: renewal.id,
            });

            // Look up suite data to enrich financial fields from the budget sheet
            const suite = await this.suiteRepository.findBySuiteId(renewal.property, renewal.suite).catch(() => null);
            const suiteCharges = suite?.charges;

            // Map UpcomingRenewal DTO to Renewal entity schema format
            const renewalData = {
                mriLeaseId: renewal.id,
                tenantId: renewal.tenantId || renewal.id, // MasterOccupantID, fallback to LeaseID
                propertyId: renewal.property,
                propertyName: propertyName || renewal.property,
                tenantName: renewal.legalName||renewal.OccupantName||'Unknown' ,
                address: renewal.address || '',
                suite: renewal.suite,
                sf: parseFloat(renewal.sf) || 0,
                leaseEnd: renewal.expDate !== 'N/A' ? new Date(renewal.expDate) : new Date(),
                currentMonthRent: suiteCharges?.baseRentMonth || renewal.monthlyRent || 0,
                rentPerSf: renewal.rentPerSf || 0,
                currentRentPerSf: (() => {
                    const monthRent = suiteCharges?.baseRentMonth || renewal.monthlyRent || 0;
                    const monthRentNum = typeof monthRent === 'string' ? parseFloat(monthRent) : monthRent;
                    const sqFt = parseFloat(renewal.sf) || 0;
                    return sqFt > 0 ? Number((monthRentNum / sqFt).toFixed(2)) : 0;
                })(),
                budget_negotiation: {
                    tiPerSf: suite?.tiPerSf ? parseFloat(suite.tiPerSf) : 0,
                    rcd: suite?.rcd || '',
                    rentPerSf: suite?.baseRentPerSf ? parseFloat(suite.baseRentPerSf) : (
                        renewal.budgetRent && parseFloat(renewal.budgetSf) > 0
                            ? renewal.budgetRent / parseFloat(renewal.budgetSf)
                            : 0
                    ),
                },
                status: this.mapStatus(renewal.status),
                notes: renewal.note || '',
                option: renewal.option || 'N/A',
                optionTerm: renewal.optionTerm || '',
                lastSyncAt: new Date(),
                // Additional MRI fields
                leaseId: renewal.leaseId || '',
                legalName: renewal.legalName || '',
                address1: renewal.address1 || '',
                address2: renewal.address2 || '',
                city: renewal.city || '',
                state: renewal.state || '',
                zip: renewal.zip || '',
                leaseStop: renewal.leaseStop || 'N',
                origSqFt: renewal.origSqFt || '0',
                term: renewal.term || '0',
                billingEmailAddress: renewal.billingEmailAddress || '',
                emailAddress: renewal.emailAddress || '',
                // Financial fields — prefer suite charges (from budget sheet) over MRI zeros
                monthlyRent: suiteCharges?.baseRentMonth || renewal.monthlyRent || 0,
                cam: suiteCharges?.camMonth || renewal.cam || 0,
                ins: suiteCharges?.insMonth || renewal.ins || 0,
                tax: suiteCharges?.taxMonth || renewal.tax || 0,
                totalDueMonthly: suiteCharges?.totalDueMonth || renewal.totalDueMonthly || 0,
                balanceForward: renewal.balanceForward ?? 0,
                cashReceived: renewal.cashReceived ?? 0,
                balanceDue: renewal.balanceDue ?? 0,
                days0To30: renewal.days0To30 ? parseFloat(renewal.days0To30) : 0,
                days31To60: renewal.days31To60 ? parseFloat(renewal.days31To60) : 0,
                days61Plus: renewal.days61Plus ? parseFloat(renewal.days61Plus) : 0,
                totalArBalance: renewal.balanceDue ?? 0,
                rentEscalations: {},
                mriData: {},
            };

            if (existingRenewal) {
                // For existing renewals: update MRI + suite fields via $set with dot-notation
                // so manually-set negotiation fields (annInc, term, freeMonths etc.) are preserved
                const updateSet: Record<string, any> = {
                    tenantId: renewalData.tenantId,
                    propertyId: renewalData.propertyId,
                    propertyName: renewalData.propertyName,
                    tenantName: renewalData.tenantName,
                    address: renewalData.address,
                    suite: renewalData.suite,
                    sf: renewalData.sf,
                    leaseEnd: renewalData.leaseEnd,
                    currentMonthRent: renewalData.currentMonthRent,
                    rentPerSf: renewalData.rentPerSf,
                    currentRentPerSf: renewalData.currentRentPerSf,
                    option: renewalData.option,
                    optionTerm: renewalData.optionTerm,
                    notes: renewalData.notes,
                    // Additional MRI fields
                    leaseId: renewalData.leaseId,
                    legalName: renewalData.legalName,
                    address1: renewalData.address1,
                    address2: renewalData.address2,
                    city: renewalData.city,
                    state: renewalData.state,
                    zip: renewalData.zip,
                    leaseStop: renewalData.leaseStop,
                    origSqFt: renewalData.origSqFt,
                    term: renewalData.term,
                    billingEmailAddress: renewalData.billingEmailAddress,
                    emailAddress: renewalData.emailAddress,
                    // Financial fields
                    monthlyRent: renewalData.monthlyRent,
                    cam: renewalData.cam,
                    ins: renewalData.ins,
                    tax: renewalData.tax,
                    totalDueMonthly: renewalData.totalDueMonthly,
                    balanceForward: renewalData.balanceForward,
                    cashReceived: renewalData.cashReceived,
                    balanceDue: renewalData.balanceDue,
                    days0To30: renewalData.days0To30,
                    days31To60: renewalData.days31To60,
                    days61Plus: renewalData.days61Plus,
                    totalArBalance: renewalData.totalArBalance,
                    lastSyncAt: renewalData.lastSyncAt,
                };
                // Only overwrite suite-sourced budget fields if suite data exists
                if (suite) {
                    if (suite.tiPerSf) updateSet['budget_negotiation.tiPerSf'] = parseFloat(suite.tiPerSf);
                    if (suite.rcd) updateSet['budget_negotiation.rcd'] = suite.rcd;
                    if (suite.baseRentPerSf) updateSet['budget_negotiation.rentPerSf'] = parseFloat(suite.baseRentPerSf);
                }
                await this.renewalModel.updateOne({ _id: existingRenewal._id }, { $set: updateSet });
                updated++;
            } else {
                // Create new renewal — set files to empty array only on creation
                await this.renewalModel.create({ ...renewalData, files: [] });
                created++;
            }
        }

        // Deactivate renewals that are no longer in the sync (mark as DEAD)
        const idsToDeactivate = currentActiveIds.filter(id => !syncedIds.has(id));
        if (idsToDeactivate.length > 0) {
            const deactivateResult = await this.renewalModel.updateMany(
                { mriLeaseId: { $in: idsToDeactivate } },
                { 
                    status: 'DEAD',
                    lastSyncAt: new Date(),
                }
            );
            const deactivated = deactivateResult.modifiedCount;
            this.logger.log(`Deactivated ${deactivated} renewals that are no longer in MRI`);
        }

        const expiredResult = await this.renewalModel.updateMany(
            {
                leaseEnd: { $lt: new Date() },
                status: { $ne: 'DEAD' },
            },
            { status: 'DEAD', lastSyncAt: new Date() },
        );
        if (expiredResult.modifiedCount > 0) {
            this.logger.log(`Marked ${expiredResult.modifiedCount} already-expired renewals as DEAD`);
        }

        this.logger.log(`Sync completed: ${created} created, ${updated} updated`);

        return { created, updated, deactivated: idsToDeactivate.length };
    }

    /**
     * Map UpcomingRenewal status to Renewal entity status enum
     */
    private mapStatus(status?: string): string {
        const statusMap: Record<string, string> = {
            // MRI OccupancyStatus values
            'Current': 'DRAFTING_AMENDMENT',
            'Vacant': 'DRAFTING_AMENDMENT',
            'Notice': 'SEND_COURTESY_NOTICE',
            'Eviction': 'SEND_THREE_DAY_NOTICE',
            'Month-to-Month': 'DRAFTING_AMENDMENT',
            // Internal status values
            'Renewal Negotiation': 'DRAFTING_AMENDMENT',
            'Drafting Amendment': 'DRAFTING_AMENDMENT',
            'Out for Execution': 'OUT_FOR_EXECUTION',
            'Drafting Lease': 'DRAFTING_LEASE',
            'Dead': 'DEAD',
            'No Contact': 'NO_CONTACT',
            'Amendment Executed': 'AMENDMENT_EXECUTED',
            'Renewed': 'AMENDMENT_EXECUTED',
            'Send Attorney Notice': 'SEND_ATTORNEY_NOTICE',
            'Send Courtesy Notice': 'SEND_COURTESY_NOTICE',
            'Send Three Day Notice': 'SEND_THREE_DAY_NOTICE',
        };
        return statusMap[status || ''] || 'DRAFTING_AMENDMENT';
    }

    /**
     * Get renewals for a specific property with pagination
     */
    // async getPropr
    async getRenewalsByProperty(
        propertyId: string, 
        page: number = 1, 
        limit: number = 50
    ): Promise<UpcomingRenewal[]> {
        if (!propertyId) return [];

        const skip = (page - 1) * limit;
        // limit=301 is the "fetch all" sentinel — remove the cap so all records come back
        const mongoLimit = limit >= 301 ? 0 : limit;
        
        const renewals = await this.renewalModel
            .find({ propertyId: propertyId, status: { $ne: 'DEAD' } })
            .sort({ leaseEnd: 1 })
            .skip(skip)
            .limit(mongoLimit)
            .lean()
            .exec();

        // Convert Renewal entity to UpcomingRenewal DTO format
        return renewals.map(renewal => ({
            id: renewal.mriLeaseId,
            tenant: renewal.tenantName,
            property: renewal.propertyId,
            suite: renewal.suite,
            sf: renewal.sf.toString(),
            expDate: renewal.leaseEnd.toISOString(),
            option: renewal.option || 'N/A',
            optionTerm: renewal.optionTerm,
            tiPerSf: 'N/A',
            budgetSf: renewal.sf.toString(),
            status: this.unmapStatus(renewal.status),
            note: renewal.notes,
            monthlyRent: renewal.monthlyRent,
            cam: renewal.cam,
            ins: renewal.ins,
            tax: renewal.tax,
            totalDueMonthly: renewal.totalDueMonthly,
            balanceForward: renewal.balanceForward,
            cashReceived: renewal.cashReceived,
            balanceDue: renewal.balanceDue,
            days0To30: renewal.days0To30?.toString(),
            days31To60: renewal.days31To60?.toString(),
            days61Plus: renewal.days61Plus?.toString(),
        }));
    }

    /**
     * Unmap Renewal entity status enum to UpcomingRenewal status
     */
    private unmapStatus(status: string): string {
        const statusMap: Record<string, string> = {
            'DRAFTING_AMENDMENT': 'Renewal Negotiation',
            'OUT_FOR_EXECUTION': 'Out for Execution',
            'DRAFTING_LEASE': 'Drafting Lease',
            'DEAD': 'Dead',
            'NO_CONTACT': 'No Contact',
            'AMENDMENT_EXECUTED': 'Renewed',
            'SEND_ATTORNEY_NOTICE': 'Send Attorney Notice',
            'SEND_COURTESY_NOTICE': 'Send Courtesy Notice',
            'SEND_THREE_DAY_NOTICE': 'Send Three Day Notice',
        };

        return statusMap[status] || 'Renewal Negotiation';
    }

    /**
     * Get all active renewals
     */
    async getAllActiveRenewals(): Promise<UpcomingRenewal[]> {
        const renewals = await this.renewalModel
            .find({ status: { $ne: 'DEAD' } })
            .sort({ propertyId: 1, leaseEnd: 1 })
            .lean()
            .exec();

        return renewals.map(renewal => ({
            id: renewal.mriLeaseId,
            tenant: renewal.tenantName,
            property: renewal.propertyId,
            suite: renewal.suite,
            sf: renewal.sf.toString(),
            expDate: renewal.leaseEnd.toISOString(),
            option: renewal.option || 'N/A',
            optionTerm: renewal.optionTerm,
            tiPerSf: 'N/A',
            budgetSf: renewal.sf.toString(),
            status: this.unmapStatus(renewal.status),
            note: renewal.notes,
            monthlyRent: renewal.monthlyRent,
            cam: renewal.cam,
            ins: renewal.ins,
            tax: renewal.tax,
            totalDueMonthly: renewal.totalDueMonthly,
            balanceForward: renewal.balanceForward,
            cashReceived: renewal.cashReceived,
            balanceDue: renewal.balanceDue,
            days0To30: renewal.days0To30?.toString(),
            days31To60: renewal.days31To60?.toString(),
            days61Plus: renewal.days61Plus?.toString(),
        }));
    }

    /**
     * Get renewal count by property
     */
    async getRenewalCountByProperty(propertyId: string): Promise<number> {
        return this.renewalModel.countDocuments({ 
            propertyId: propertyId, 
            status: { $ne: 'DEAD' }
        });
    }

    /**
     * Get last sync information
     */
    async getLastSyncInfo(): Promise<{
        lastSyncedAt: Date | null;
        syncJobId: string | null;
        totalActive: number;
    }> {
        const lastSynced = await this.renewalModel
            .findOne({ status: { $ne: 'DEAD' } })
            .sort({ lastSyncAt: -1 })
            .select('lastSyncAt')
            .lean();

        const totalActive = await this.renewalModel.countDocuments({ status: { $ne: 'DEAD' } });

        return {
            lastSyncedAt: lastSynced?.lastSyncAt || null,
            syncJobId: null, // Not stored in the new schema
            totalActive
        };
    }

    /**
     * Clear all renewal data (for testing/reset purposes)
     */
    async clearAllRenewals(): Promise<number> {
        const result = await this.renewalModel.deleteMany({});
        this.logger.log(`Cleared ${result.deletedCount} renewal records`);
        return result.deletedCount;
    }
}
