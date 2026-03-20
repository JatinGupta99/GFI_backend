import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MriVacantSuitesService } from '../rent-roll/mri/mri-vacant-suites.service';
import { LeadsRepository } from '../leads/repository/lead.repository';
import { RenewalRepository } from '../renewals/repositories/renewal.repository';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertyStatsDto } from './dto/property-stats.dto';
import { AggregatedStatsDto, CategoryStatsDto } from './dto/aggregated-stats.dto';
import { PropertyRepository } from './repository/property.repository';
import { Property } from './schema/property.entity';
import { Lead } from '../leads/schema/lead.schema';
import { Renewal } from '../renewals/renewal.entity';

@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);
  private readonly PROPERTIES_CACHE_KEY = 'properties_all';

  constructor(
    private readonly propertyRepository: PropertyRepository,
    private readonly mriVacantSuitesService: MriVacantSuitesService,
    private readonly leadsRepository: LeadsRepository,
    private readonly renewalRepository: RenewalRepository,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) { }

  async create(createPropertyDto: CreatePropertyDto) {
    const result = await this.propertyRepository.create(createPropertyDto);
    await this.cacheManager.del(this.PROPERTIES_CACHE_KEY);
    return result;
  }

  async findAll(): Promise<Property[]> {
    const cachedData = await this.cacheManager.get<Property[]>(this.PROPERTIES_CACHE_KEY);
    if (cachedData) {
      this.logger.log('Returning properties from cache');
      return cachedData;
    }

    this.logger.log('[EXEC] Fetching properties from database');
    const properties = await this.propertyRepository.findAll();
    await this.cacheManager.set(this.PROPERTIES_CACHE_KEY, properties, 3600000); // 1 hour
    return properties;
  }

  findOne(propertyId: string) {
    return this.propertyRepository.findById(propertyId);
  }

  async findByName(propertyName: string): Promise<Property | null> {
    return this.propertyRepository.findByName(propertyName);
  }

  async findByNameFuzzy(propertyName: string): Promise<Property | null> {
    return this.propertyRepository.findByNameFuzzy(propertyName);
  }

  async update(propertyId: string, updatePropertyDto: UpdatePropertyDto) {
    const result = await this.propertyRepository.update(propertyId, updatePropertyDto);
    await this.cacheManager.del(this.PROPERTIES_CACHE_KEY);
    return result;
  }

  async remove(propertyId: string) {
    const result = await this.propertyRepository.delete(propertyId);
    await this.cacheManager.del(this.PROPERTIES_CACHE_KEY);
    return result;
  }

  async getVacantSuites(buildingId: string, afterDate?: string) {
    const vacantSuites = await this.mriVacantSuitesService.fetch(buildingId, afterDate);

    return vacantSuites;
  }

  /**
   * Save or update property from ForeSight extraction
   */
  async saveForeSightProperty(
    propertyId: string,
    propertyName: string,
    region: string,
  ): Promise<Property> {
    this.logger.log(
      `Saving ForeSight property: ${propertyId} - ${propertyName}`,
    );

    const result = await this.propertyRepository.upsert(propertyId, {
      propertyName: propertyName as any, // Cast to PropertyName enum
      region,
    });

    await this.cacheManager.del(this.PROPERTIES_CACHE_KEY);

    this.logger.log(`Successfully saved property ${propertyId}`);
    return result;
  }

  /**
   * Get property statistics including vacant spaces, LOI negotiation, lease negotiation, and renewals
   */
  async getPropertyStats(propertyId: string): Promise<PropertyStatsDto> {
    this.logger.log(`Fetching stats for property: ${propertyId}`);

    // Get property details
    const property = await this.propertyRepository.findById(propertyId);
    if (!property) {
      throw new Error(`Property not found: ${propertyId}`);
    }

    // 1. Get vacant spaces SF from MRI
    let vacantSpacesSf = 0;
    try {
      const vacantSuites = await this.mriVacantSuitesService.fetch(propertyId);
      vacantSpacesSf = vacantSuites.reduce((total, suite) => {
        const sf = parseFloat(suite.SuiteSquareFeet) || 0;
        return total + sf;
      }, 0);
    } catch (error) {
      this.logger.error(`Failed to fetch vacant suites for property ${propertyId}:`, error);
    }

    // 2. Get LOI Negotiation SF from leads
    const loiLeads = await this.leadsRepository.find(
      { 
        propertyId: propertyId,
        lead_status: 'LOI_NEGOTIATION'
      },
      0,
      10000,
      {}
    );
    const loiNegotiationSf = loiLeads.reduce((total, lead) => {
      const sf = parseFloat(lead.general?.sf || '0') || 0;
      return total + sf;
    }, 0);

    // 3. Get Lease Negotiation SF from leads
    const leaseLeads = await this.leadsRepository.find(
      { 
        propertyId: propertyId,
        lead_status: 'LEASE_NEGOTIATION'
      },
      0,
      10000,
      {}
    );
    const leaseNegotiationSf = leaseLeads.reduce((total, lead) => {
      const sf = parseFloat(lead.general?.sf || '0') || 0;
      return total + sf;
    }, 0);

    // 4. Get Renewals SF
    const renewals = await this.renewalRepository.getRenewalsByProperty(propertyId);
    const renewalsSf = renewals.reduce((total, renewal) => {
      return total + (renewal.sf || 0);
    }, 0);

    return {
      propertyId: property.propertyId,
      propertyName: property.propertyName,
      vacantSpacesSf,
      loiNegotiationSf,
      leaseNegotiationSf,
      renewalsSf,
    };
  }

  /**
   * Get aggregated statistics across all properties or filtered by property IDs
   * Results are cached in Redis based on propertyIds
   */
  async getAggregatedStats(propertyIds?: string[]): Promise<AggregatedStatsDto> {
    // Generate cache key based on propertyIds
    const cacheKey = this.generateAggregatedStatsCacheKey(propertyIds);
    
    // Try to get from cache
    const cachedData = await this.cacheManager.get<AggregatedStatsDto>(cacheKey);
    if (cachedData) {
      this.logger.log(`Returning aggregated stats from cache: ${cacheKey}`);
      return cachedData;
    }

    this.logger.log(`Fetching aggregated stats${propertyIds ? ` for properties: ${propertyIds.join(', ')}` : ' across all properties'}`);

    // Get properties to process
    let propertiesToProcess: string[];
    
    if (propertyIds && propertyIds.length > 0) {
      // Use provided property IDs
      propertiesToProcess = propertyIds;
    } else {
      // Get all properties
      const properties = await this.propertyRepository.findAll();
      propertiesToProcess = properties.map(p => p.propertyId);
    }

    // 1. Vacant Spaces Stats
    let vacantSpacesCount = 0;
    let vacantSpacesTotalSf = 0;
    const vacantSpacesProperties = new Set<string>();

    for (const propertyId of propertiesToProcess) {
      try {
        const vacantSuites = await this.mriVacantSuitesService.fetch(propertyId);
        if (vacantSuites.length > 0) {
          vacantSpacesProperties.add(propertyId);
          vacantSpacesCount += vacantSuites.length;
          vacantSpacesTotalSf += vacantSuites.reduce((total, suite) => {
            return total + (parseFloat(suite.SuiteSquareFeet) || 0);
          }, 0);
        }
      } catch (error) {
        this.logger.error(`Failed to fetch vacant suites for property ${propertyId}:`, error);
      }
    }

    // 2. LOI Negotiation Stats
    const loiFilter: any = { lead_status: 'LOI_NEGOTIATION' };
    if (propertyIds && propertyIds.length > 0) {
      loiFilter.propertyId = { $in: propertyIds };
    }
    
    const loiLeads = await this.leadsRepository.find(loiFilter, 0, 10000, {});
    const loiProperties = new Set(loiLeads.map(lead => lead.propertyId).filter(Boolean));
    const loiTotalSf = loiLeads.reduce((total, lead) => {
      return total + (parseFloat(lead.general?.sf || '0') || 0);
    }, 0);

    // 3. Lease Negotiation Stats
    const leaseFilter: any = { lead_status: 'LEASE_NEGOTIATION' };
    if (propertyIds && propertyIds.length > 0) {
      leaseFilter.propertyId = { $in: propertyIds };
    }
    
    const leaseLeads = await this.leadsRepository.find(leaseFilter, 0, 10000, {});
    const leaseProperties = new Set(leaseLeads.map(lead => lead.propertyId).filter(Boolean));
    const leaseTotalSf = leaseLeads.reduce((total, lead) => {
      return total + (parseFloat(lead.general?.sf || '0') || 0);
    }, 0);

    // 4. Renewals Stats
    const renewalFilters: any = { limit: 10000 };
    if (propertyIds && propertyIds.length > 0) {
      renewalFilters.propertyIds = propertyIds;
    }
    
    const allRenewals = await this.renewalRepository.getRenewals(renewalFilters);
    const renewalProperties = new Set(allRenewals.map(renewal => renewal.propertyId).filter(Boolean));
    const renewalsTotalSf = allRenewals.reduce((total, renewal) => {
      return total + (renewal.sf || 0);
    }, 0);

    const result: AggregatedStatsDto = {
      vacantSpaces: {
        count: vacantSpacesCount,
        totalSf: vacantSpacesTotalSf,
        propertyCount: vacantSpacesProperties.size,
      },
      loiNegotiation: {
        count: loiLeads.length,
        totalSf: loiTotalSf,
        propertyCount: loiProperties.size,
      },
      leaseNegotiation: {
        count: leaseLeads.length,
        totalSf: leaseTotalSf,
        propertyCount: leaseProperties.size,
      },
      renewals: {
        count: allRenewals.length,
        totalSf: renewalsTotalSf,
        propertyCount: renewalProperties.size,
      },
    };

    // Cache the result for 5 minutes (300 seconds)
    await this.cacheManager.set(cacheKey, result, 300000);
    this.logger.log(`Cached aggregated stats: ${cacheKey}`);

    return result;
  }

  /**
   * Generate cache key for aggregated stats based on propertyIds
   */
  private generateAggregatedStatsCacheKey(propertyIds?: string[]): string {
    if (!propertyIds || propertyIds.length === 0) {
      return 'aggregated_stats:all';
    }
    
    // Sort property IDs to ensure consistent cache keys
    const sortedIds = [...propertyIds].sort().join(',');
    return `aggregated_stats:${sortedIds}`;
  }
}

