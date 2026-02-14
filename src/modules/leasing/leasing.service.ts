import {
    Injectable,
    Logger,
    Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as cacheManager from 'cache-manager';
import pLimit from 'p-limit';

import { MriLeasesService } from '../rent-roll/mri/mri-leases.service';
import { MriRenewalOffersService } from '../rent-roll/mri/mri-renewal-offers.service';
import { MriLeaseEmeaService } from '../rent-roll/mri/mri-lease-emea.service';
import { MriNotesService } from '../rent-roll/mri/mri-notes.service';
import { MriOptionsService } from '../rent-roll/mri/mri-options.service';
import { MriChargesService } from '../rent-roll/mri/mri-charges.service';

import { UpcomingRenewal } from './dto/upcoming-renewal.dto';
import { PropertiesService } from '../properties/properties.service';
import { Property } from '../properties/schema/property.entity';

@Injectable()
export class LeasingService {
    private readonly logger = new Logger(LeasingService.name);

    /**
     * Limits concurrent MRI calls across properties
     */
    private readonly globalLimit = pLimit(3);

    /**
     * Limits per-lease MRI fan-out (notes/options/charges)
     */
    private readonly leaseLimit = pLimit(5);

    /**
     * Cache TTLs (seconds)
     */
    private static readonly OFFERS_TTL = 300; // 5 min
    private static readonly EMEA_TTL = 300;
    private static readonly LEASES_TTL = 60;

    constructor(
        @Inject(CACHE_MANAGER)
        private readonly cache: cacheManager.Cache,

        private readonly leasesService: MriLeasesService,
        private readonly renewalOffersService: MriRenewalOffersService,
        private readonly emeaService: MriLeaseEmeaService,
        private readonly notesService: MriNotesService,
        private readonly optionsService: MriOptionsService,
        private readonly chargesService: MriChargesService,
        private readonly propertiesService: PropertiesService,
    ) { }

    /* -------------------------------------------------------------------------- */
    /*                               PUBLIC API                                   */
    /* -------------------------------------------------------------------------- */

    async getAllUpcomingRenewals(): Promise<UpcomingRenewal[]> {
        this.logger.log('Starting aggregation of upcoming renewals');

        const properties: Property[] = await this.propertiesService.findAll();
        if (!properties?.length) {
            this.logger.warn('No properties found');
            return [];
        }

        const results = await Promise.all(
            properties.map(property =>
                this.globalLimit(() =>
                    this.getUpcomingRenewals(property.propertyId),
                ),
            ),
        );

        const flattened = results.flat();

        this.logger.log(
            `Aggregation complete: ${flattened.length} renewals from ${properties.length} properties`,
        );

        return flattened;
    }

    async getUpcomingRenewals(
        propertyId: string,
        page = 1,
        limit = 50,
    ): Promise<UpcomingRenewal[]> {
        const skip = (page - 1) * limit;

        this.logger.debug(
            `Fetching leases | property=${propertyId} page=${page} limit=${limit}`,
        );

        const leases = await this.getCached(
            `leases:${propertyId}:${page}:${limit}`,
            () => this.leasesService.fetch(propertyId, limit, skip),
            LeasingService.LEASES_TTL,
            [],
        );

        if (!leases.length) return [];

        const [offers, emea] = await Promise.all([
            this.getCached(
                `offers:${propertyId}`,
                () => this.renewalOffersService.fetch(propertyId),
                LeasingService.OFFERS_TTL,
                [],
            ),
            this.getCached(
                `emea:${propertyId}`,
                () => this.emeaService.fetch(propertyId),
                LeasingService.EMEA_TTL,
                [],
            ),
        ]);

        const offersMap = new Map(offers.map(o => [o.LeaseID, o]));
        const emeaMap = new Map(emea.map(e => [e.LeaseId, e]));

        return Promise.all(
            leases.map(lease =>
                this.leaseLimit(() =>
                    this.mapLeaseToUpcomingRenewal(
                        propertyId,
                        lease,
                        offersMap,
                        emeaMap,
                    ),
                ),
            ),
        );
    }

    /* -------------------------------------------------------------------------- */
    /*                             MAPPING LOGIC                                   */
    /* -------------------------------------------------------------------------- */

    private async mapLeaseToUpcomingRenewal(
        propertyId: string,
        lease: any,
        offersMap: Map<string, any>,
        emeaMap: Map<string, any>,
    ): Promise<UpcomingRenewal> {
        const [notes, options, charges] = await Promise.all([
            this.safeFetch(
                () => this.notesService.fetch(propertyId, lease.LeaseID),
                [],
            ),
            this.safeFetch(
                () => this.optionsService.fetch(propertyId, lease.LeaseID),
                [],
            ),
            this.safeFetch(
                () => this.chargesService.fetch(lease.LeaseID),
                [],
            ),
        ]);

        const annualBaseRent =
            charges
                .filter(c =>
                    ['RNT', 'RENT', 'BASE'].includes(
                        c.ChargeCode?.toUpperCase(),
                    ),
                )
                .reduce((sum, c) => sum + (c.Amount || 0), 0) * 12;

        const sf = options[0]?.SquareFeet || lease.OrigSqFt || 0;
        const rentPerSf = sf > 0 ? +(annualBaseRent / sf).toFixed(2) : 0;

        const optionTerm = options.length
            ? options
                .map(
                    o =>
                        `Option ${o.OptionNumber ?? 'N/A'}: ${o.TermInMonths ?? 0
                        } months`,
                )
                .join(', ')
            : 'N/A';

        return {
            id: lease.LeaseID,
            tenant: lease.OccupantName,
            property: lease.BuildingName,
            suite: lease.SuiteID,
            sf,
            expDate:
                emeaMap.get(lease.LeaseID)?.Expiration ||
                offersMap.get(lease.LeaseID)?.ExpirationDate ||
                'N/A',
            option: options.length ? 'Yes' : 'No',
            optionTerm,
            rentPerSf,
            ti: 'N/A',
            lcd: 'N/A',
            budgetSf: sf,
            budgetRent: 0,
            budgetLcd: 'N/A',
            status: 'Renewal Negotiation',
            note: notes.map(n => n.text).join('; '),
        };
    }

    /* -------------------------------------------------------------------------- */
    /*                              CACHE UTILS                                    */
    /* -------------------------------------------------------------------------- */

    private async getCached<T>(
        key: string,
        fn: () => Promise<T>,
        ttlSeconds: number,
        fallback: T,
    ): Promise<T> {
        const cached = await this.cache.get<T>(key);
        if (cached) return cached;

        const value = await this.safeFetch(fn, fallback);
        await this.cache.set(key, value, ttlSeconds);
        return value;
    }

    private async safeFetch<T>(
        fn: () => Promise<T>,
        fallback: T,
    ): Promise<T> {
        try {
            return await fn();
        } catch (error) {
            this.logger.error(
                `Third-party API failed: ${error?.message}`,
                error?.stack,
            );
            return fallback;
        }
    }
}