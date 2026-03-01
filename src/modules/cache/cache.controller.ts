import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { CacheService } from './cache.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('cache')
export class CacheController {
  constructor(private readonly cacheService: CacheService) {}

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refreshCache() {
    await this.cacheService.clearAll();
    return {
      success: true,
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
