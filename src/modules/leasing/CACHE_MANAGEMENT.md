# Renewals Cache Management

## Overview

The renewals system uses Redis cache to store API responses and reduce calls to the MRI API. This document explains how cache is managed.

## Cached Data

The following data is cached:

1. **All Renewals** (`all-renewals`)
   - Complete list of all renewals across all properties
   - Set after successful sync job completion

2. **Property Leases** (`leases:{propertyId}:{page}:{limit}`)
   - Leases for specific property with pagination
   - TTL: 5 minutes (300 seconds)

3. **Renewal Offers** (`offers:{propertyId}`)
   - Renewal offers for specific property
   - TTL: 10 minutes (600 seconds)

4. **EMEA Data** (`emea:{propertyId}`)
   - EMEA data for specific property
   - TTL: 10 minutes (600 seconds)

## Automatic Cache Clearing

### When Sync Job is Queued

Cache is automatically cleared when you trigger a new sync:

```bash
POST /leasing/renewals/sync
```

**What happens:**
1. Clears `all-renewals` cache
2. Clears all property-specific caches:
   - `leases:{propertyId}:*`
   - `offers:{propertyId}`
   - `emea:{propertyId}`
3. Queues the sync job
4. Returns job ID for tracking

**Response:**
```json
{
  "message": "Renewals sync job queued successfully. Cache cleared.",
  "jobId": "123",
  "statusUrl": "/leasing/renewals/sync/123"
}
```

### Disable Auto-Clear (Optional)

If you want to queue a sync without clearing cache:

```typescript
await leasingService.queueRenewalsSync({
  clearCache: false  // Don't clear cache
});
```

## Manual Cache Clearing

### Clear All Renewal Cache

```bash
POST /leasing/renewals/cache/clear
```

**Response:**
```json
{
  "message": "Renewals cache cleared successfully"
}
```

**Use cases:**
- Force fresh data fetch without running full sync
- Clear stale cache after manual data changes
- Troubleshooting cache-related issues

## Cache Flow

### Normal Flow (with cache)

```
1. User requests renewals
   ↓
2. Check Redis cache
   ↓
3. If cached → Return immediately
   ↓
4. If not cached → Call MRI API
   ↓
5. Store in cache with TTL
   ↓
6. Return data
```

### Sync Flow (cache cleared)

```
1. POST /leasing/renewals/sync
   ↓
2. Clear all renewal caches
   ↓
3. Queue background job
   ↓
4. Job fetches fresh data from MRI
   ↓
5. Process all properties/leases
   ↓
6. Store results in cache
   ↓
7. Cache available for fast reads
```

## Cache Keys by Property

For a property with ID `006146`:

```
leases:006146:1:50      → Leases (page 1, limit 50)
leases:006146:1:100     → Leases (page 1, limit 100)
leases:006146:1:1000    → Leases (page 1, limit 1000)
offers:006146           → Renewal offers
emea:006146             → EMEA data
```

## Best Practices

### 1. Clear Cache Before Important Syncs

Always clear cache when you need the most up-to-date data:

```bash
# Automatic (recommended)
POST /leasing/renewals/sync

# Manual
POST /leasing/renewals/cache/clear
# Then trigger sync
POST /leasing/renewals/sync
```

### 2. Use Cached Endpoint for Fast Reads

After a successful sync, use the cached endpoint:

```bash
GET /leasing/renewals/cached
```

This returns instantly without any API calls.

### 3. Monitor Cache TTLs

- Leases: 5 minutes
- Offers: 10 minutes
- EMEA: 10 minutes

If data seems stale, clear cache manually.

### 4. Scheduled Syncs Clear Cache Automatically

The cron jobs automatically clear cache:

```typescript
// Every 6 hours
@Cron(CronExpression.EVERY_6_HOURS)
async handleRenewalsSync() {
  // Automatically clears cache
  await this.leasingService.queueRenewalsSync();
}
```

## Troubleshooting

### Issue: Stale Data

**Solution:**
```bash
POST /leasing/renewals/cache/clear
```

### Issue: Cache Not Clearing

**Check:**
1. Redis connection is active
2. Logs show "🗑️ Clearing renewals cache..."
3. Logs show "✅ Cleared cache for X properties"

### Issue: Slow Response After Cache Clear

**Expected behavior:**
- First request after cache clear will be slow (calls MRI API)
- Subsequent requests will be fast (served from cache)

## API Reference

| Endpoint | Method | Description | Clears Cache |
|----------|--------|-------------|--------------|
| `/leasing/renewals/sync` | POST | Queue sync job | ✅ Yes (auto) |
| `/leasing/renewals/cache/clear` | POST | Clear cache only | ✅ Yes |
| `/leasing/renewals/cached` | GET | Get cached results | ❌ No |
| `/leasing/renewals/sync/:jobId` | GET | Check job status | ❌ No |
| `/leasing/renewals` | GET | Get property renewals | ❌ No |

## Logs

When cache is cleared, you'll see:

```
[LeasingService] 🗑️  Clearing renewals cache...
[LeasingService] ✅ Cleared cache for 20 properties
[LeasingService] Queued renewals sync job: 123
```

## Configuration

Cache TTLs are configured in `LeasingService`:

```typescript
private static readonly OFFERS_TTL = 600;  // 10 minutes
private static readonly EMEA_TTL = 600;    // 10 minutes
private static readonly LEASES_TTL = 300;  // 5 minutes
```

To change TTLs, update these constants and restart the service.
