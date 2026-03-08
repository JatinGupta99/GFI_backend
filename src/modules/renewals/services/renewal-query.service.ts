import { Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { RenewalRepository } from '../repositories/renewal.repository';
import { Renewal } from '../renewal.entity';
import { RenewalFilters } from '../interfaces/renewal-provider.interface';

@Injectable()
export class RenewalQueryService {
  private readonly logger = new Logger(RenewalQueryService.name);
  private readonly CACHE_TTL = 600; // 10 minutes

  constructor(
    private readonly renewalRepository: RenewalRepository,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getRenewals(filters: RenewalFilters = {}): Promise<{
    data: Renewal[];
    total: number;
    cached: boolean;
  }> {
    const cacheKey = this.generateCacheKey('renewals', filters);
    
    // Debug: Log the filters and cache key
    this.logger.debug(`getRenewals called with filters: ${JSON.stringify(filters)}`);
    this.logger.debug(`Generated cache key: ${cacheKey}`);
    
    try {
      // Try cache first
      const cached = await this.cacheManager.get<{
        data: Renewal[];
        total: number;
        timestamp: number;
      }>(cacheKey);

      if (cached && this.isCacheValid(cached.timestamp)) {
        this.logger.debug(`✅ Cache HIT for key: ${cacheKey} - returning ${cached.data.length} records`);
        return {
          data: cached.data,
          total: cached.total,
          cached: true,
        };
      }

      this.logger.debug(`❌ Cache MISS for key: ${cacheKey} - fetching from database`);
      
      // Cache miss - fetch from database
      const [data, total] = await Promise.all([
        this.renewalRepository.getRenewals(filters),
        this.renewalRepository.countRenewals(filters),
      ]);
      
      const result = {
        data,
        total,
        timestamp: Date.now(),
      };

      // Cache the result
      await this.cacheManager.set(cacheKey, result, this.CACHE_TTL * 1000);
      
      this.logger.debug(`💾 Cached ${data.length} renewals (total: ${total}) with key: ${cacheKey}`);
      
      return {
        data: result.data,
        total: result.total,
        cached: false,
      };
    } catch (error) {
      this.logger.error(`Failed to get renewals: ${error.message}`);
      throw error;
    }
  }

  async getRenewalsByProperty(propertyId: string): Promise<{
    data: Renewal[];
    cached: boolean;
  }> {
    const cacheKey = `renewals:property:${propertyId}`;
    
    try {
      const cached = await this.cacheManager.get<{
        data: Renewal[];
        timestamp: number;
      }>(cacheKey);

      if (cached && this.isCacheValid(cached.timestamp)) {
        return {
          data: cached.data,
          cached: true,
        };
      }

      const data = await this.renewalRepository.getRenewalsByProperty(propertyId);
      const result = {
        data,
        timestamp: Date.now(),
      };

      await this.cacheManager.set(cacheKey, result, this.CACHE_TTL * 1000);
      
      return {
        data: result.data,
        cached: false,
      };
    } catch (error) {
      this.logger.error(`Failed to get renewals for property ${propertyId}: ${error.message}`);
      throw error;
    }
  }

  async getUpcomingRenewals(daysAhead: number = 90): Promise<{
    data: Renewal[];
    cached: boolean;
  }> {
    const cacheKey = `renewals:upcoming:${daysAhead}`;
    
    try {
      const cached = await this.cacheManager.get<{
        data: Renewal[];
        timestamp: number;
      }>(cacheKey);

      if (cached && this.isCacheValid(cached.timestamp)) {
        return {
          data: cached.data,
          cached: true,
        };
      }

      const data = await this.renewalRepository.getUpcomingRenewals(daysAhead);
      const result = {
        data,
        timestamp: Date.now(),
      };

      await this.cacheManager.set(cacheKey, result, this.CACHE_TTL * 1000);
      
      return {
        data: result.data,
        cached: false,
      };
    } catch (error) {
      this.logger.error(`Failed to get upcoming renewals: ${error.message}`);
      throw error;
    }
  }

  async getRenewalStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byProperty: Record<string, number>;
    upcomingCount: number;
    cached: boolean;
  }> {
    const cacheKey = 'renewals:stats';
    
    try {
      const cached = await this.cacheManager.get<{
        stats: any;
        timestamp: number;
      }>(cacheKey);

      if (cached && this.isCacheValid(cached.timestamp)) {
        return {
          ...cached.stats,
          cached: true,
        };
      }

      const stats = await this.renewalRepository.getRenewalStats();
      const result = {
        stats,
        timestamp: Date.now(),
      };

      await this.cacheManager.set(cacheKey, result, this.CACHE_TTL * 1000);
      
      return {
        ...stats,
        cached: false,
      };
    } catch (error) {
      this.logger.error(`Failed to get renewal stats: ${error.message}`);
      throw error;
    }
  }

  async searchRenewals(searchTerm: string, limit: number = 50): Promise<{
    data: Renewal[];
    cached: boolean;
  }> {
    const cacheKey = `renewals:search:${searchTerm}:${limit}`;
    
    try {
      const cached = await this.cacheManager.get<{
        data: Renewal[];
        timestamp: number;
      }>(cacheKey);

      if (cached && this.isCacheValid(cached.timestamp)) {
        return {
          data: cached.data,
          cached: true,
        };
      }

      // Perform text search on tenant name, property name, and unit
      const data = await this.renewalRepository.getRenewals({
        limit,
      });

      // Filter results based on search term (in-memory search for now)
      const filteredData = data.filter(renewal =>
        renewal.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        renewal.propertyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        renewal.unit.toLowerCase().includes(searchTerm.toLowerCase())
      );

      const result = {
        data: filteredData,
        timestamp: Date.now(),
      };

      await this.cacheManager.set(cacheKey, result, this.CACHE_TTL * 1000);
      
      return {
        data: result.data,
        cached: false,
      };
    } catch (error) {
      this.logger.error(`Failed to search renewals: ${error.message}`);
      throw error;
    }
  }

  async clearCache(pattern?: string): Promise<void> {
    try {
      if (pattern) {
        // Clear specific cache pattern
        this.logger.log(`Clearing cache pattern: ${pattern}`);
        this.logger.warn('Pattern-based cache clearing not fully implemented for in-memory cache');
      } else {
        // Clear all cache - use store.reset() which exists but isn't in types
        const store = (this.cacheManager as any).store;
        if (store && typeof store.reset === 'function') {
          await store.reset();
          this.logger.log('✅ Cleared all renewal cache');
        } else {
          // Fallback: manually delete known cache keys
          this.logger.warn('⚠️  Cache reset not available, attempting manual clear');
          // Note: This is a limitation of in-memory cache without pattern support
          // Cache will expire naturally after TTL (10 minutes)
        }
      }
    } catch (error) {
      this.logger.error(`Failed to clear cache: ${error.message}`);
      throw error;
    }
  }


  async clearPropertyCache(propertyId: string): Promise<void> {
    try {
      const cacheKey = `renewals:property:${propertyId}`;
      await this.cacheManager.del(cacheKey);
      this.logger.log(`Cleared cache for property ${propertyId}`);
    } catch (error) {
      this.logger.error(`Failed to clear property cache: ${error.message}`);
      throw error;
    }
  }

  async clearStatsCache(): Promise<void> {
    try {
      await this.cacheManager.del('renewals:stats');
      this.logger.log('Cleared stats cache');
    } catch (error) {
      this.logger.error(`Failed to clear stats cache: ${error.message}`);
      throw error;
    }
  }

  async updateRenewalNotes(id: string, notes: string): Promise<{
    data: Renewal | null;
    success: boolean;
  }> {
    try {
      const updated = await this.renewalRepository.updateRenewalNotes(id, notes);
      
      if (updated) {
        // Clear cache since data changed
        await this.clearCache();
        this.logger.log(`Updated notes for renewal ${id}`);
      }
      
      return {
        data: updated,
        success: !!updated,
      };
    } catch (error) {
      this.logger.error(`Failed to update renewal notes: ${error.message}`);
      throw error;
    }
  }

  async getRenewalById(id: string): Promise<{
    data: Renewal | null;
    cached: boolean;
  }> {
    const cacheKey = `renewals:id:${id}`;
    
    try {
      const cached = await this.cacheManager.get<{
        data: Renewal;
        timestamp: number;
      }>(cacheKey);

      if (cached && this.isCacheValid(cached.timestamp)) {
        return {
          data: cached.data,
          cached: true,
        };
      }

      const data = await this.renewalRepository.getRenewalById(id);
      
      if (data) {
        const result = {
          data,
          timestamp: Date.now(),
        };

        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL * 1000);
      }
      
      return {
        data,
        cached: false,
      };
    } catch (error) {
      this.logger.error(`Failed to get renewal by ID ${id}: ${error.message}`);
      throw error;
    }
  }

private generateCacheKey(prefix: string, filters: RenewalFilters): string {
  const limit = filters.limit || 20;
  const offset = filters.offset;

  const status = filters.status?.length
    ? filters.status.sort().join(',')
    : 'all';

  const propertyIds = filters.propertyIds?.length
    ? filters.propertyIds.sort().join(',')
    : 'all';

  const key = `${prefix}:${limit}:${offset}:${status}:${propertyIds}`;

  this.logger.debug(`🔑 Cache key: ${key}`);

  return key;
}

  private isCacheValid(timestamp: number): boolean {
    const age = Date.now() - timestamp;
    return age < this.CACHE_TTL * 1000;
  }
}