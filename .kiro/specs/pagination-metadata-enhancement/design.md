# Design: Pagination Metadata Enhancement

## Overview
Add `hasMore` and `hasPrev` boolean fields to pagination metadata across all paginated endpoints. Create a reusable pagination helper to ensure consistency and reduce code duplication.

## Architecture

### 1. Pagination Helper Utility

Create a centralized pagination metadata builder:

```typescript
// src/common/helpers/pagination.helper.ts

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
  hasPrev: boolean;
  offset?: number;
  cached?: boolean;
}

export interface PaginationInput {
  total: number;
  page?: number;
  limit: number;
  offset?: number;
  cached?: boolean;
}

export class PaginationHelper {
  /**
   * Build standardized pagination metadata
   * Supports both page-based and offset-based pagination
   */
  static buildMeta(input: PaginationInput): PaginationMeta {
    const { total, limit, offset, cached } = input;
    
    // Calculate page from offset if not provided
    const page = input.page ?? (offset !== undefined ? Math.floor(offset / limit) + 1 : 1);
    
    // Calculate total pages
    const totalPages = Math.ceil(total / limit) || 1;
    
    // Calculate hasMore and hasPrev
    const hasMore = page < totalPages;
    const hasPrev = page > 1;
    
    const meta: PaginationMeta = {
      total,
      page,
      limit,
      totalPages,
      hasMore,
      hasPrev,
    };
    
    // Add optional fields
    if (offset !== undefined) {
      meta.offset = offset;
    }
    
    if (cached !== undefined) {
      meta.cached = cached;
    }
    
    return meta;
  }
  
  /**
   * Build metadata from offset-based pagination
   */
  static buildMetaFromOffset(
    total: number,
    offset: number,
    limit: number,
    cached?: boolean
  ): PaginationMeta {
    return this.buildMeta({ total, offset, limit, cached });
  }
  
  /**
   * Build metadata from page-based pagination
   */
  static buildMetaFromPage(
    total: number,
    page: number,
    limit: number,
    cached?: boolean
  ): PaginationMeta {
    return this.buildMeta({ total, page, limit, cached });
  }
}
```

### 2. Update Leads Service

Modify `/api/leasing/active-leads` to use the pagination helper:

```typescript
// src/modules/leads/leads.service.ts

import { PaginationHelper } from '../../common/helpers/pagination.helper';

async findAll(query: PaginationQueryDto) {
  // ... existing filter logic ...
  
  const [data, total] = await Promise.all([
    this.repo.find(filter, skip, limit, sort),
    this.repo.count(filter),
  ]);

  return {
    data: data.map((item: any) => ({
      ...item,
      id: item._id?.toString(),
      fullName: `${item.general?.firstName || ''} ${item.general?.lastName || ''}`.trim(),
    })),
    meta: PaginationHelper.buildMetaFromPage(total, page, limit),
  };
}
```

### 3. Update Renewals Controller

Modify `/api/renewals` to use the pagination helper:

```typescript
// src/modules/renewals/renewals.controller.ts

import { PaginationHelper } from '../../common/helpers/pagination.helper';

@Get()
async getRenewals(
  @Query('propertyIds') propertyIds?: string | string[],
  @Query('status') status?: string | string[],
  @Query('limit') limit?: number,
  @Query('offset') offset?: number,
) {
  const filters: RenewalFilters = {};

  if (propertyIds) {
    filters.propertyIds = Array.isArray(propertyIds) ? propertyIds : [propertyIds];
  }

  if (status) {
    filters.status = Array.isArray(status) ? status : [status];
  }

  // Default values
  const limitValue = limit ? Number(limit) : 20;
  const offsetValue = offset ? Number(offset) : 0;
  
  filters.limit = limitValue;
  filters.offset = offsetValue;

  const result = await this.queryService.getRenewals(filters);

  return {
    success: true,
    data: result.data,
    meta: PaginationHelper.buildMetaFromOffset(
      result.total,
      offsetValue,
      limitValue,
      result.cached
    ),
  };
}
```

## API Response Examples

### Before (Active Leads)
```json
{
  "data": [...],
  "meta": {
    "total": 18,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### After (Active Leads)
```json
{
  "data": [...],
  "meta": {
    "total": 18,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasMore": false,
    "hasPrev": false
  }
}
```

### Before (Renewals)
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 20,
    "limit": 20,
    "cached": true
  }
}
```

### After (Renewals)
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 20,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasMore": false,
    "hasPrev": false,
    "offset": 0,
    "cached": true
  }
}
```

## Edge Cases

### First Page with More Data
```json
{
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5,
    "hasMore": true,   // ← More pages available
    "hasPrev": false   // ← No previous page
  }
}
```

### Middle Page
```json
{
  "meta": {
    "total": 100,
    "page": 3,
    "limit": 20,
    "totalPages": 5,
    "hasMore": true,   // ← More pages available
    "hasPrev": true    // ← Previous pages available
  }
}
```

### Last Page
```json
{
  "meta": {
    "total": 100,
    "page": 5,
    "limit": 20,
    "totalPages": 5,
    "hasMore": false,  // ← No more pages
    "hasPrev": true    // ← Previous pages available
  }
}
```

### Empty Results
```json
{
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasMore": false,
    "hasPrev": false
  }
}
```

### Single Item (Less than Limit)
```json
{
  "meta": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasMore": false,
    "hasPrev": false
  }
}
```

## Implementation Details

### Calculation Logic

```typescript
// Total pages calculation
const totalPages = Math.ceil(total / limit) || 1;

// Page calculation from offset (if needed)
const page = Math.floor(offset / limit) + 1;

// hasMore: true if current page is less than total pages
const hasMore = page < totalPages;

// hasPrev: true if current page is greater than 1
const hasPrev = page > 1;
```

### Backward Compatibility

All existing fields are preserved:
- ✅ `total` - unchanged
- ✅ `page` - unchanged (added to renewals)
- ✅ `limit` - unchanged
- ✅ `totalPages` - unchanged (added to renewals)
- ✅ `offset` - unchanged (optional)
- ✅ `cached` - unchanged (optional)
- ✅ `hasMore` - NEW
- ✅ `hasPrev` - NEW

No breaking changes - only additions.

## Testing Strategy

### suite Tests for PaginationHelper

```typescript
describe('PaginationHelper', () => {
  describe('buildMetaFromPage', () => {
    it('should calculate hasMore and hasPrev for first page', () => {
      const meta = PaginationHelper.buildMetaFromPage(100, 1, 20);
      expect(meta.hasMore).toBe(true);
      expect(meta.hasPrev).toBe(false);
      expect(meta.totalPages).toBe(5);
    });

    it('should calculate hasMore and hasPrev for middle page', () => {
      const meta = PaginationHelper.buildMetaFromPage(100, 3, 20);
      expect(meta.hasMore).toBe(true);
      expect(meta.hasPrev).toBe(true);
    });

    it('should calculate hasMore and hasPrev for last page', () => {
      const meta = PaginationHelper.buildMetaFromPage(100, 5, 20);
      expect(meta.hasMore).toBe(false);
      expect(meta.hasPrev).toBe(true);
    });

    it('should handle single page', () => {
      const meta = PaginationHelper.buildMetaFromPage(10, 1, 20);
      expect(meta.hasMore).toBe(false);
      expect(meta.hasPrev).toBe(false);
      expect(meta.totalPages).toBe(1);
    });

    it('should handle empty results', () => {
      const meta = PaginationHelper.buildMetaFromPage(0, 1, 20);
      expect(meta.hasMore).toBe(false);
      expect(meta.hasPrev).toBe(false);
      expect(meta.totalPages).toBe(1);
    });
  });

  describe('buildMetaFromOffset', () => {
    it('should calculate page from offset', () => {
      const meta = PaginationHelper.buildMetaFromOffset(100, 40, 20);
      expect(meta.page).toBe(3);
      expect(meta.hasMore).toBe(true);
      expect(meta.hasPrev).toBe(true);
    });

    it('should handle offset 0', () => {
      const meta = PaginationHelper.buildMetaFromOffset(100, 0, 20);
      expect(meta.page).toBe(1);
      expect(meta.hasMore).toBe(true);
      expect(meta.hasPrev).toBe(false);
    });
  });
});
```

### Integration Tests

```typescript
describe('GET /api/leasing/active-leads', () => {
  it('should return pagination metadata with hasMore and hasPrev', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/leasing/active-leads?page=1&limit=10')
      .expect(200);

    expect(response.body.meta).toHaveProperty('total');
    expect(response.body.meta).toHaveProperty('page');
    expect(response.body.meta).toHaveProperty('limit');
    expect(response.body.meta).toHaveProperty('totalPages');
    expect(response.body.meta).toHaveProperty('hasMore');
    expect(response.body.meta).toHaveProperty('hasPrev');
    expect(typeof response.body.meta.hasMore).toBe('boolean');
    expect(typeof response.body.meta.hasPrev).toBe('boolean');
  });
});

describe('GET /api/renewals', () => {
  it('should return pagination metadata with hasMore and hasPrev', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/renewals?limit=10&offset=0')
      .expect(200);

    expect(response.body.meta).toHaveProperty('total');
    expect(response.body.meta).toHaveProperty('page');
    expect(response.body.meta).toHaveProperty('limit');
    expect(response.body.meta).toHaveProperty('totalPages');
    expect(response.body.meta).toHaveProperty('hasMore');
    expect(response.body.meta).toHaveProperty('hasPrev');
    expect(response.body.meta).toHaveProperty('offset');
    expect(response.body.meta).toHaveProperty('cached');
  });
});
```

## Files to Modify

1. **NEW**: `src/common/helpers/pagination.helper.ts` - Pagination utility
2. **UPDATE**: `src/modules/leads/leads.service.ts` - Use pagination helper
3. **UPDATE**: `src/modules/renewals/renewals.controller.ts` - Use pagination helper
4. **NEW**: `src/common/helpers/pagination.helper.spec.ts` - suite tests

## Benefits

1. **Simplified Frontend Logic**: No need to calculate `hasMore` or `hasPrev` on the client
2. **Consistency**: All paginated endpoints return the same metadata structure
3. **Reusability**: Single helper function for all pagination needs
4. **Type Safety**: TypeScript interfaces ensure correct usage
5. **Backward Compatible**: No breaking changes to existing APIs
6. **Testable**: Easy to suite test pagination logic

## Migration Path

1. Create `PaginationHelper` utility
2. Update leads service to use helper
3. Update renewals controller to use helper
4. Add suite tests for helper
5. Add integration tests for updated endpoints
6. Deploy and verify
7. Update API documentation
8. Notify frontend team of new fields

## Future Enhancements

- Add cursor-based pagination support
- Add `nextCursor` and `prevCursor` fields
- Support for custom page sizes
- Add `firstPage` and `lastPage` URLs
