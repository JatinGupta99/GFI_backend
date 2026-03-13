import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Renewal, RenewalDocument } from '../../renewals/renewal.entity';
import { UpcomingRenewal } from '../dto/upcoming-renewal.dto';

@Injectable()
export class RenewalRepository {
    private readonly logger = new Logger(RenewalRepository.name);

    constructor(
        @InjectModel(Renewal.name) private renewalModel: Model<RenewalDocument>,
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
                propertyId: renewal.property
            });
            const property=await this.getRenewalsByProperty
            // Map UpcomingRenewal DTO to Renewal entity schema format
            // The schema expects: mriLeaseId, tenantId, propertyId, propertyName, tenantName, suite, leaseEnd, currentMonthRent, lastSyncAt, status
            // All optional fields get default values instead of undefined to ensure consistent schema
            const renewalData = {
                mriLeaseId: renewal.id,
                tenantId: renewal.id, // Using lease ID as tenant ID since we don't have separate tenant ID
                propertyId: renewal.property, // This is now the actual property ID (e.g., "008214")
                propertyName: propertyName || renewal.property, // Use actual property name from properties collection
                tenantName: renewal.tenant,
                suite: renewal.suite,
                sf: parseFloat(renewal.sf) || 0,
                leaseEnd: renewal.expDate !== 'N/A' ? new Date(renewal.expDate) : new Date(),
                currentMonthRent: renewal.monthlyRent || 0,
                rentPerSf: renewal.rentPerSf || 0,
                currentRentPerSf: renewal.rentPerSf || 0,
                budget_negotiation: {
                    tiPerSf: 0, // Not available in UpcomingRenewal
                    rcd: '', // Not available in UpcomingRenewal
                    rentPerSf: renewal.budgetRent && parseFloat(renewal.budgetSf) > 0 
                        ? renewal.budgetRent / parseFloat(renewal.budgetSf) 
                        : 0,
                    baseRent: 0, // Not available in UpcomingRenewal
                },
                status: this.mapStatus(renewal.status),
                notes: renewal.note || '',
                option: renewal.option || 'N/A',
                optionTerm: renewal.optionTerm || '',
                lastSyncAt: new Date(),
                // Financial fields from MRI APIs - always save with default values
                monthlyRent: renewal.monthlyRent ?? 0,
                cam: renewal.cam ?? 0,
                ins: renewal.ins ?? 0,
                tax: renewal.tax ?? 0,
                totalDueMonthly: renewal.totalDueMonthly ?? 0,
                balanceForward: renewal.balanceForward ?? 0,
                cashReceived: renewal.cashReceived ?? 0,
                balanceDue: renewal.balanceDue ?? 0,
                days0To30: renewal.days0To30 ? parseFloat(renewal.days0To30) : 0,
                days31To60: renewal.days31To60 ? parseFloat(renewal.days31To60) : 0,
                days61Plus: renewal.days61Plus ? parseFloat(renewal.days61Plus) : 0,
                totalArBalance: (renewal.balanceDue ?? 0),
                // Rent escalations - empty object if not available
                rentEscalations: {},
                // MRI raw data - empty object if not available
                mriData: {},
                // Files array - empty array if not available
                files: [],
            };

            if (existingRenewal) {
                // Update existing renewal
                await this.renewalModel.updateOne(
                    { _id: existingRenewal._id },
                    renewalData
                );
                updated++;
            } else {
                // Create new renewal
                await this.renewalModel.create(renewalData);
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

        this.logger.log(`Sync completed: ${created} created, ${updated} updated`);

        return { created, updated, deactivated: idsToDeactivate.length };
    }

    /**
     * Map UpcomingRenewal status to Renewal entity status enum
     */
    private mapStatus(status?: string): string {
        // Valid enum values: DRAFTING_AMENDMENT, OUT_FOR_EXECUTION, DRAFTING_LEASE, DEAD, NO_CONTACT, AMENDMENT_EXECUTED, SEND_ATTORNEY_NOTICE, SEND_COURTESY_NOTICE, SEND_THREE_DAY_NOTICE
        const statusMap: Record<string, string> = {
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
        const skip = (page - 1) * limit;
        
        const renewals = await this.renewalModel
            .find({ propertyId: propertyId, status: { $ne: 'DEAD' } })
            .sort({ leaseEnd: 1 }) // Sort by expiration date
            .skip(skip)
            .limit(limit)
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
