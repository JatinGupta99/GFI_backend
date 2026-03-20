import { Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';

/**
 * Improved caching strategy for MRI data with different TTLs based on data volatility
 */
@Injectable()
export class MriCacheStrategyService {
  private readonly logger = new Logger(MriCacheStrategyService.name);

  // Cache TTL configuration (in seconds)
  private readonly CACHE_TTLS = {
    charges: 24 * 60 * 60,      // 24 hours - charges change infrequently
    budget: 24 * 60 * 60,       // 24 hours - budget data is relatively stable
    annualRent: 24 * 60 * 60,   // 24 hours - annual rent changes infrequently
    ledger: 10 * 60,            // 10 minutes - ledger data changes frequently
    delinquencies: 10 * 60,     // 10 minutes - delinquencies change frequently
    openCharges: 10 * 60,       // 10 minutes - open charges change frequently
    openCredits: 10 * 60,       // 10 minutes - credits change frequently
    commercialLedger: 10 * 60,  // 10 minutes - commercial ledger changes frequently
  };

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Get cached data with appropriate TTL based on data type
   */
  async getCachedData<T>(
    dataType: keyof typeof this.CACHE_TTLS,
    cacheKey: string,
    fetchFunction: () => Promise<T>
  ): Promise<{ data: T; cached: boolean }> {
    try {
      // Try to get from cache first
      const cached = await this.cacheManager.get<{
        data: T;
        timestamp: number;
      }>(cacheKey);

      const ttl = this.CACHE_TTLS[dataType];
      
      if (cached && this.isCacheValid(cached.timestamp, ttl)) {
        this.logger.debug(`✅ Cache HIT for ${dataType} key: ${cacheKey}`);
        return {
          data: cached.data,
          cached: true,
        };
      }

      this.logger.debug(`❌ Cache MISS for ${dataType} key: ${cacheKey} - fetching fresh data`);
      
      // Fetch fresh data
      const freshData = await fetchFunction();
      
      // Cache with appropriate TTL
      await this.cacheManager.set(
        cacheKey,
        {
          data: freshData,
          timestamp: Date.now(),
        },
        ttl * 1000 // Convert to milliseconds
      );

      this.logger.debug(`💾 Cached ${dataType} data with TTL ${ttl}s for key: ${cacheKey}`);

      return {
        data: freshData,
        cached: false,
      };

    } catch (error) {
      this.logger.error(`Cache operation failed for ${dataType}: ${error.message}`);
      // Fallback to direct fetch if cache fails
      const data = await fetchFunction();
      return { data, cached: false };
    }
  }

  /**
   * Generate cache key for MRI data
   */
  generateCacheKey(
    dataType: string,
    propertyId: string,
    leaseId?: string,
    additionalParams?: Record<string, any>
  ): string {
    const parts = ['mri', dataType, propertyId];
    
    if (leaseId) {
      parts.push(leaseId);
    }
    
    if (additionalParams) {
      const paramString = Object.keys(additionalParams)
        .sort()
        .map(key => `${key}:${additionalParams[key]}`)
        .join('|');
      parts.push(paramString);
    }
    
    return parts.join(':');
  }

  /**
   * Clear cache for specific data types or patterns
   */
  async clearCache(pattern?: string): Promise<void> {
    try {
      if (pattern) {
        // Clear specific pattern (implementation depends on cache manager)
        this.logger.log(`🗑️  Clearing cache for pattern: ${pattern}`);
        // Note: This would need to be implemented based on your cache manager
        // For now, we'll just log it
      } else {
        // Clear all MRI cache
        this.logger.log(`🗑️  Clearing all MRI cache`);
        // Note: Cache reset implementation depends on cache manager type
        // await this.cacheManager.reset(); // Uncomment if your cache manager supports reset
      }
    } catch (error) {
      this.logger.error(`Failed to clear cache: ${error.message}`);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalKeys: number;
    hitRate: number;
    memoryUsage: number;
  }> {
    // This would need to be implemented based on your cache manager
    // For now, return placeholder data
    return {
      totalKeys: 0,
      hitRate: 0,
      memoryUsage: 0,
    };
  }

  /**
   * Warm up cache for a property by pre-fetching common data
   */
  async warmUpCache(
    propertyId: string,
    leaseIds: string[],
    fetchFunctions: {
      charges: (propertyId: string, leaseId: string) => Promise<any>;
      budget: (propertyId: string, leaseId: string) => Promise<any>;
      annualRent: (propertyId: string, leaseId: string) => Promise<any>;
    }
  ): Promise<void> {
    this.logger.log(`🔥 Warming up cache for property ${propertyId} with ${leaseIds.length} leases`);

    const warmupPromises = leaseIds.map(async (leaseId) => {
      try {
        // Pre-fetch stable data (charges, budget, annual rent)
        await Promise.all([
          this.getCachedData('charges', 
            this.generateCacheKey('charges', propertyId, leaseId),
            () => fetchFunctions.charges(propertyId, leaseId)
          ),
          this.getCachedData('budget',
            this.generateCacheKey('budget', propertyId, leaseId),
            () => fetchFunctions.budget(propertyId, leaseId)
          ),
          this.getCachedData('annualRent',
            this.generateCacheKey('annualRent', propertyId, leaseId),
            () => fetchFunctions.annualRent(propertyId, leaseId)
          ),
        ]);
      } catch (error) {
        this.logger.warn(`Failed to warm up cache for lease ${leaseId}: ${error.message}`);
      }
    });

    await Promise.allSettled(warmupPromises);
    this.logger.log(`✅ Cache warmup completed for property ${propertyId}`);
  }

  private isCacheValid(timestamp: number, ttlSeconds: number): boolean {
    const now = Date.now();
    const age = (now - timestamp) / 1000; // Convert to seconds
    return age < ttlSeconds;
  }
}