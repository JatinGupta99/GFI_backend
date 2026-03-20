import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async clearAll(): Promise<void> {
    try {
      // For Redis cache manager, we need to use the store's flushAll method
      const store = (this.cacheManager as any).store;
      if (store && typeof store.flushAll === 'function') {
        await store.flushAll();
        this.logger.log('All cache cleared successfully using flushAll');
      } else if (store && typeof store.reset === 'function') {
        await store.reset();
        this.logger.log('All cache cleared successfully using reset');
      } else if (typeof (this.cacheManager as any).reset === 'function') {
        await (this.cacheManager as any).reset();
        this.logger.log('All cache cleared successfully using cacheManager.reset');
      } else {
        // Fallback: try to clear by getting all keys and deleting them
        this.logger.warn('No direct clear all method found, attempting fallback');
        if (store && typeof store.keys === 'function') {
          const keys = await store.keys('*');
          if (keys && keys.length > 0) {
            await Promise.all(keys.map((key: string) => this.cacheManager.del(key)));
            this.logger.log(`Cleared ${keys.length} cache keys`);
          } else {
            this.logger.log('No cache keys found to clear');
          }
        } else {
          throw new Error('Cache manager does not support clearing all cache');
        }
      }
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
