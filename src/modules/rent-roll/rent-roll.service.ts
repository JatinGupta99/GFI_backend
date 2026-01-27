import { Injectable, Logger } from '@nestjs/common';
import { RentRollRow } from './dto/rent-roll-row.dto';
import { MriLeasesService } from './mri/mri-leases.service';
import { MriOptionsService } from './mri/mri-options.service';
import { MriChargesService } from './mri/mri-charges.service';
import { MriArService } from './mri/mri-ar.service';
import { MriNotesService } from './mri/mri-notes.service';

@Injectable()
export class RentRollService {
    private readonly logger = new Logger(RentRollService.name);

    constructor(
        private readonly leasesService: MriLeasesService,
        private readonly optionsService: MriOptionsService,
        private readonly chargesService: MriChargesService,
        private readonly arService: MriArService,
        private readonly notesService: MriNotesService,
    ) { }

    async getRentRoll(propertyId: string): Promise<RentRollRow[]> {
        this.logger.log(`START getRentRoll() for Property ID: ${propertyId}`);

        // 1. Fetch Base Leases
        const leases = await this.leasesService.fetch(propertyId);

        if (!leases || !Array.isArray(leases) || leases.length === 0) {
            this.logger.warn(`No leases found for property ${propertyId}`);
            return [];
        }

        // 2. Filter Leases (OccupancyStatus = 'Current')
        const currentLeases = leases.filter(l =>
            l.OccupancyStatus?.toUpperCase() === 'CURRENT' || !l.OccupancyStatus
        );

        this.logger.log(`Processing ${currentLeases.length} current leases with reduced concurrency`);

        const rows: RentRollRow[] = [];
        const CHUNK_SIZE = 5;

        for (let i = 0; i < currentLeases.length; i += CHUNK_SIZE) {
            const chunk = currentLeases.slice(i, i + CHUNK_SIZE);
            this.logger.log(`Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(currentLeases.length / CHUNK_SIZE)}`);

            const chunkResults = await Promise.all(chunk.map(async (lease, index) => {
                const globalIndex = i + index;
                this.logger.debug(`[${globalIndex}] Fetching details for LeaseID=${lease.LeaseID}`);

                // Parallel sub-fetches for THIS lease (Safe logic catches individual subsystem failures)
                const [options, charges, ar, notes] = await Promise.all([
                    this.safeFetch(() => this.optionsService.fetch(lease.LeaseID), []),
                    this.safeFetch(() => this.chargesService.fetch(lease.LeaseID), []),
                    this.safeFetch(() => this.arService.fetch(lease.MasterOccupantID), []),
                    this.safeFetch(() => this.notesService.fetch(propertyId, lease.LeaseID), []),
                ]);

                const baseRentCharges = charges.filter(c =>
                    ['RNT', 'RENT', 'BASE'].includes(c.ChargeCode?.toUpperCase())
                );
                const nnnCharges = charges.filter(c =>
                    ['NNN', 'CAM', 'TAX', 'INS'].includes(c.ChargeCode?.toUpperCase())
                );

                const annualBaseRent = baseRentCharges.reduce((sum, c) => sum + (c.Amount || 0), 0) * 12;
                const annualNnn = nnnCharges.reduce((sum, c) => sum + (c.Amount || 0), 0) * 12;

                const sf = lease.OrigSqFt || 0;
                const annualRentPerSF = sf > 0 ? annualBaseRent / sf : 0;
                const nnnPerSF = sf > 0 ? annualNnn / sf : 0;

                const row: RentRollRow = {
                    propertyName: lease.BuildingName,
                    tenantName: lease.OccupantName,
                    suite: lease.SuiteID,
                    sf: sf,
                    options: options.map(o => o.OptionType).join(', ') || '',
                    annualRentPerSF: Number(annualRentPerSF.toFixed(2)),
                    nnnPerSF: Number(nnnPerSF.toFixed(2)),
                    arBalance: Number(ar.reduce((sum, item) => sum + (item.Balance || 0), 0).toFixed(2)),
                    notes: notes.map(n => n.text).join('; ') || '',
                    optionTerm: options.map(o => `${o.StartDate} - ${o.EndDate}`).join('; ') || '',
                };

                return row;
            }));

            rows.push(...chunkResults);

            // Short delay to avoid overloading
            if (i + CHUNK_SIZE < currentLeases.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        this.logger.log(`END getRentRoll() - Total rows returned=${rows.length}`);
        return rows;
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
