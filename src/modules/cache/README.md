# Cache Management API

## Overview
This module provides endpoints to manage application cache (Redis/Memory).

## Endpoints

### Refresh Cache (Clear All)
Clears all cached data from the cache store.

**Endpoint:** `POST /api/cache/refresh`

**Authentication:** Required (JWT)

**Request:**
```bash
curl -X POST http://localhost:4020/api/cache/refresh \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Cache cleared successfully",
  "timestamp": "2026-02-27T11:30:00.000Z"
}
```

## Service Methods

The `CacheService` provides the following methods:

### `clearAll()`
Clears all cache entries.

### `clearByKey(key: string)`
Clears a specific cache key.

### `clearByPattern(pattern: string)`
Clears all cache keys matching a pattern (Redis only).

## Usage in Other Services

```typescript
import { CacheService } from '../cache/cache.service';

@Injectable()
export class YourService {
  constructor(private readonly cacheService: CacheService) {}

  async someMethod() {
    // Clear all cache
    await this.cacheService.clearAll();
    
    // Clear specific key
    await this.cacheService.clearByKey('properties:*');
    
    // Clear by pattern (Redis only)
    await this.cacheService.clearByPattern('leads:*');
  }
}
```

## Notes
- The endpoint requires JWT authentication
- Pattern-based deletion only works with Redis store
- All operations are logged for monitoring
