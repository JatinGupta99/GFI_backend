import { Injectable, Logger } from '@nestjs/common';

export interface RateLimiterOptions {
  maxConcurrent: number;
  minTime: number; // milliseconds between requests
  maxRequestsPerWindow: number;
  windowMs: number;
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private queue: Array<() => Promise<any>> = [];
  private running = 0;
  private requestTimes: number[] = [];

  constructor(private readonly options: RateLimiterOptions) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await this.executeWithRateLimit(fn);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async executeWithRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    // Check window-based rate limit (e.g., 2500 calls / 5 minutes)
    await this.waitForWindowRateLimit();
    
    // Check concurrent limit (e.g., max 8 concurrent)
    await this.waitForConcurrencySlot();
    
    // Check minimum time between requests (e.g., 120ms)
    await this.waitForMinTime();

    this.running++;
    const startTime = Date.now();
    this.requestTimes.push(startTime);

    try {
      const result = await fn();
      return result;
    } finally {
      this.running--;
      
      // Ensure minimum time between requests
      const elapsed = Date.now() - startTime;
      if (elapsed < this.options.minTime) {
        await this.delay(this.options.minTime - elapsed);
      }
      
      this.processQueue();
    }
  }

  private async waitForWindowRateLimit(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    
    // Remove old requests outside the window
    this.requestTimes = this.requestTimes.filter(time => time > windowStart);
    
    // Check if we're at the limit
    if (this.requestTimes.length >= this.options.maxRequestsPerWindow) {
      const oldestRequest = Math.min(...this.requestTimes);
      const waitTime = oldestRequest + this.options.windowMs - now + 1000; // +1s buffer
      
      if (waitTime > 0) {
        this.logger.warn(`Rate limit reached, waiting ${waitTime}ms`);
        await this.delay(waitTime);
        return this.waitForWindowRateLimit(); // Recheck after waiting
      }
    }
  }

  private async waitForConcurrencySlot(): Promise<void> {
    while (this.running >= this.options.maxConcurrent) {
      await this.delay(10); // Check every 10ms
    }
  }

  private async waitForMinTime(): Promise<void> {
    if (this.requestTimes.length === 0) return;
    
    const lastRequestTime = Math.max(...this.requestTimes);
    const timeSinceLastRequest = Date.now() - lastRequestTime;
    
    if (timeSinceLastRequest < this.options.minTime) {
      await this.delay(this.options.minTime - timeSinceLastRequest);
    }
  }

  private processQueue(): void {
    if (this.queue.length === 0 || this.running >= this.options.maxConcurrent) {
      return;
    }

    const nextTask = this.queue.shift();
    if (nextTask) {
      nextTask();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    const recentRequests = this.requestTimes.filter(time => time > windowStart);
    
    return {
      running: this.running,
      queued: this.queue.length,
      requestsInWindow: recentRequests.length,
      windowUtilization: (recentRequests.length / this.options.maxRequestsPerWindow * 100).toFixed(1) + '%',
      concurrencyUtilization: (this.running / this.options.maxConcurrent * 100).toFixed(1) + '%',
    };
  }
}