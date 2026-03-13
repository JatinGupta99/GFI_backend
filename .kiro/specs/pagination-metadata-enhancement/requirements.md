# Requirements: Pagination Metadata Enhancement

## Problem Statement
Current pagination metadata only includes `total`, `page`, `limit`, and `totalPages`. Frontend developers need `hasMore` and `hasPrev` boolean flags to easily determine if there are more pages to load or if the user can navigate to previous pages, without having to calculate this from the existing fields.

## Current Behavior

### API: `/api/leasing/active-leads`
```json
{
  "meta": {
    "total": 18,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### API: `/api/renewals`
```json
{
  "meta": {
    "total": 20,
    "limit": 20,
    "cached": true
  }
}
```

**Issues:**
- Frontend must calculate `hasMore = page < totalPages`
- Frontend must calculate `hasPrev = page > 1`
- Inconsistent metadata structure between endpoints
- Missing `page` field in renewals API

## Expected Behavior

### API: `/api/leasing/active-leads`
```json
{
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

### API: `/api/renewals`
```json
{
  "meta": {
    "total": 20,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasMore": false,
    "hasPrev": false,
    "cached": true
  }
}
```

## Acceptance Criteria

### 1.1 Add Pagination Helper Fields
- [ ] Add `hasMore` boolean field to pagination metadata
- [ ] Add `hasPrev` boolean field to pagination metadata
- [ ] `hasMore = true` when `page < totalPages`
- [ ] `hasPrev = true` when `page > 1`
- [ ] Fields are calculated automatically from existing pagination data

### 1.2 Update Active Leads API
- [ ] `/api/leasing/active-leads` includes `hasMore` and `hasPrev`
- [ ] Existing fields (`total`, `page`, `limit`, `totalPages`) remain unchanged
- [ ] Backward compatible with existing frontend code

### 1.3 Update Renewals API
- [ ] `/api/renewals` includes `hasMore` and `hasPrev`
- [ ] Add missing `page` field (defaults to 1 if not provided)
- [ ] Add missing `totalPages` field (calculated from total/limit)
- [ ] Preserve `cached` field
- [ ] Backward compatible with existing frontend code

### 1.4 Standardize Pagination Response
- [ ] Create reusable pagination metadata builder/helper
- [ ] All paginated endpoints use consistent metadata structure
- [ ] Helper automatically calculates `hasMore`, `hasPrev`, and `totalPages`

### 1.5 Edge Cases
- [ ] First page: `hasPrev = false`, `hasMore = true` (if more pages exist)
- [ ] Last page: `hasPrev = true`, `hasMore = false`
- [ ] Single page: `hasPrev = false`, `hasMore = false`
- [ ] Empty results: `hasPrev = false`, `hasMore = false`, `total = 0`

## User Stories

### Story 1: Frontend Pagination Controls
**As a** frontend developer  
**I want** `hasMore` and `hasPrev` boolean flags in the API response  
**So that** I can easily show/hide next/previous buttons without calculating from other fields

**Acceptance Criteria:**
- `hasMore` indicates if "Next" button should be enabled
- `hasPrev` indicates if "Previous" button should be enabled
- No client-side calculation needed

### Story 2: Infinite Scroll Implementation
**As a** frontend developer  
**I want** a simple `hasMore` flag  
**So that** I can implement infinite scroll without complex logic

**Acceptance Criteria:**
- Check `hasMore` to determine if more data should be loaded
- Works with both offset-based and page-based pagination

### Story 3: Consistent API Responses
**As a** frontend developer  
**I want** consistent pagination metadata across all endpoints  
**So that** I can reuse pagination components and logic

**Acceptance Criteria:**
- All paginated endpoints return the same metadata structure
- Same field names and calculation logic everywhere

## Technical Notes

### Pagination Metadata Structure
```typescript
interface PaginationMeta {
  total: number;        // Total number of records
  page: number;         // Current page number (1-indexed)
  limit: number;        // Records per page
  totalPages: number;   // Total number of pages
  hasMore: boolean;     // True if there are more pages after current
  hasPrev: boolean;     // True if there are pages before current
  cached?: boolean;     // Optional: indicates if response is cached
}
```

### Calculation Logic
```typescript
const totalPages = Math.ceil(total / limit);
const hasMore = page < totalPages;
const hasPrev = page > 1;
```

### Affected Endpoints
1. `/api/leasing/active-leads` - Already has most fields, needs `hasMore` and `hasPrev`
2. `/api/renewals` - Needs `page`, `totalPages`, `hasMore`, and `hasPrev`
3. Any other paginated endpoints in the system

### Implementation Approach
1. Create a reusable `PaginationMetaBuilder` utility class
2. Update response interceptor or create a pagination helper
3. Update each endpoint to use the standardized builder
4. Ensure backward compatibility (don't remove existing fields)

## Success Metrics
- All paginated endpoints return consistent metadata structure
- Frontend can use `hasMore` and `hasPrev` directly without calculations
- No breaking changes to existing API consumers
- Pagination logic is centralized and reusable

## Out of Scope
- Changing pagination from page-based to cursor-based
- Adding new pagination query parameters
- Modifying the data structure (only metadata changes)

## Dependencies
- None - this is a pure enhancement to existing APIs

## Testing Strategy
1. **suite Tests**: Test pagination metadata builder with various scenarios
2. **Integration Tests**: Verify all paginated endpoints return correct metadata
3. **Edge Case Tests**: First page, last page, single page, empty results
4. **Backward Compatibility**: Ensure existing fields remain unchanged
