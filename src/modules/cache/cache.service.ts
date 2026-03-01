import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async clearAll(): Promise<void> {
    try {
      // @ts-ignore - reset method exists but not in type definition
      await this.cacheManager.reset();
      this.logger.log('All cache cleared successfully');
    } catch (error) {
      this.logger.error('Failed to clear cache', error);
      throw error;
    }
  }

  async clearByKey(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.logger.log(`Cache key "${key}" cleared successfully`);
    } catch (error) {
      this.logger.error(`Failed to clear cache key "${key}"`, error);
      throw error;
    }
  }

  async clearByPattern(pattern: string): Promise<void> {
    try {
      // @ts-ignore - store property exists but not in type definition
      const store = this.cacheManager.store as any;
      if (store.keys) {
        const keys = await store.keys(pattern);
        await Promise.all(keys.map((key: string) => this.cacheManager.del(key)));
        this.logger.log(`Cache keys matching pattern "${pattern}" cleared successfully`);
      } else {
        this.logger.warn('Cache store does not support pattern-based deletion');
      }
    } catch (error) {
      this.logger.error(`Failed to clear cache by pattern "${pattern}"`, error);
      throw error;
    }
  }
}
