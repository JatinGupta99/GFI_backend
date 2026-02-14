import { Injectable, Logger } from '@nestjs/common';
import { RentRollRow } from './dto/rent-roll-row.dto';
import { MriLeasesService } from './mri/mri-leases.service';
import { MriOptionsService } from './mri/mri-options.service';
import { MriChargesService } from './mri/mri-charges.service';
import { MriArService } from './mri/mri-ar.service';
import { MriNotesService } from './mri/mri-notes.service';
import { MriAnalysisService } from './mri/mri-analysis.service';

@Injectable()
export class RentRollService {
    private readonly logger = new Logger(RentRollService.name);

    constructor(
        private readonly leasesService: MriLeasesService,
        private readonly optionsService: MriOptionsService,
        private readonly chargesService: MriChargesService,
        private readonly arService: MriArService,
        private readonly notesService: MriNotesService,
        private readonly analysisService: MriAnalysisService,
    ) { }

    async getRentRoll(propertyId: string, page: number = 1, limit: number = 20): Promise<{ data: RentRollRow[], total: number }> {
        // Default filter: only Current leases
        const filter = `OccupancyStatus eq 'Current'`;
        return this.fetchAndAggregate(propertyId, page, limit, filter);
    }

    async getUpcomingRenewals(
        propertyId: string,
        page: number = 1,
        limit: number = 20,
        search?: string,
        status?: string
    ): Promise<{ data: RentRollRow[], total: number }> {
        const filters: string[] = [];
        const today = new Date().toISOString().split('T')[0];
        filters.push(`LeaseExpirationDate ge '${today}'`);

        if (status) {
            filters.push(`OccupancyStatus eq '${status}'`);
        }

        if (search) {
            filters.push(`(substringof('${search}', OccupantName) or substringof('${search}', SuiteID))`);
        }

        const filterStr = filters.join(' and ');
        return this.fetchAndAggregate(propertyId, page, limit, filterStr);
    }

    private async fetchAndAggregate(propertyId: string, page: number, limit: number, filter: string): Promise<{ data: RentRollRow[], total: number }> {
        this.logger.log(`START fetchAndAggregate() for Property ID: ${propertyId} (Page: ${page}, Limit: ${limit}, Filter: ${filter})`);

        const skip = (page - 1) * limit;

        // 1. Fetch Base Leases with Pagination and Filter
        const leases = await this.leasesService.fetch(propertyId, limit, skip, filter);

        if (!leases || !Array.isArray(leases) || leases.length === 0) {
            this.logger.warn(`No leases found for property ${propertyId} with filter ${filter}`);
            return { data: [], total: 0 };
        }

        const total = leases.length <= limit ? skip + leases.length : skip + limit + 1;

        this.logger.log(`Processing ${leases.length} leases with reduced concurrency`);

        const rows: RentRollRow[] = [];
        const CHUNK_SIZE = 5;

        for (let i = 0; i < leases.length; i += CHUNK_SIZE) {
            const chunk = leases.slice(i, i + CHUNK_SIZE);

            const chunkResults = await Promise.all(chunk.map(async (lease) => {
                // Parallel sub-fetches for THIS lease
                const [options, charges, ar, notes, analysis] = await Promise.all([
                    this.safeFetch(() => this.optionsService.fetch(propertyId, lease.LeaseID), []),
                    this.safeFetch(() => this.chargesService.fetch(lease.LeaseID), []),
                    this.safeFetch(() => this.arService.fetch(lease.MasterOccupantID), []),
                    this.safeFetch(() => this.notesService.fetch(propertyId, lease.LeaseID), []),
                    this.safeFetch(() => this.analysisService.fetch(propertyId, lease.LeaseID), []),
                ]);

                const baseRentCharges = charges.filter(c =>
                    ['RNT', 'RENT', 'BASE'].includes(c.ChargeCode?.toUpperCase())
                );

                const annualBaseRent = baseRentCharges.reduce((sum, c) => sum + (c.Amount || 0), 0) * 12;
                const sf = lease.OrigSqFt || 0;
                const annualRentPerSF = sf > 0 ? annualBaseRent / sf : 0;

                const leaseAnalysis = analysis.find(a => a.LeaseID === lease.LeaseID);

                const row: RentRollRow = {
                    propertyName: lease.BuildingName,
                    tenantName: lease.OccupantName,
                    suite: lease.SuiteID,
                    sf: sf,
                    expDate: lease.LeaseExpirationDate || 'N/A',
                    options: options.length > 0 ? 'Yes' : 'No',
                    optionTerm: options.length > 0
                        ? options.map(o => `${o.TermInMonths || 0} months`).join(', ')
                        : 'N/A',
                    currentRentPerSF: Number(annualRentPerSF.toFixed(2)),
                    budgetRenew: leaseAnalysis?.BudgetRenewType || 'TBD',
                    budgetRentPerSF: leaseAnalysis?.BudgetRentPerSF || 0,
                    budgetTIPerSF: leaseAnalysis?.BudgetTIPerSF || 0,
                    budgetRCD: leaseAnalysis?.BudgetRCD || 'TBD',
                    status: lease.OccupancyStatus || 'Current',
                    arBalance: Number(ar.reduce((sum, item) => sum + (item.Balance || 0), 0).toFixed(2)),
                    notes: notes.map(n => n.text).join('; ') || '',
                };

                return row;
            }));

            rows.push(...chunkResults);

            if (i + CHUNK_SIZE < leases.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        return { data: rows, total: total };
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
