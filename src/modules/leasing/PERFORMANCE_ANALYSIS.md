# Renewals Sync Performance Analysis

## Scenario: 20 Properties × 20 Leases Each

### System Configuration

| Setting | Value |
|---------|-------|
| Total Properties | 20 |
| Leases per Property | 20 |
| Total Leases | 400 |
| Batch Size | 1 property at a time |
| Delay Between Properties | 30 seconds |
| Delay Between Leases | 1 second |
| Delay Between Lease API Calls | 500ms |
| MRI Rate Limit | 100 calls per 5 minutes |

---

## API Call Breakdown Per Property

### Phase 1: Property-Level APIs (3 calls)
```
1. Leases API          → Get all 20 leases for the property
2. Offers API          → Get renewal offers (cached 10 min)
3. EMEA API            → Get expiration dates (cached 10 min)
```

### Phase 2: Lease-Level APIs (20 leases × 3 calls = 60 calls)
```
For each of 20 leases:
  1. Notes API         → Get lease notes
     ⏱️ Wait 500ms
  2. Options API       → Get lease options
     ⏱️ Wait 500ms
  3. Charges API       → Get lease charges
     ⏱️ Wait 1 second (before next lease)
```

### Total Per Property
- **API Calls**: 3 + (20 × 3) = **63 calls**
- **Time**: ~3s (property APIs) + ~40s (lease APIs) = **~43 seconds**

---

## Complete Processing Timeline

### Property 1
```
┌─────────────────────────────────────────────────────────────┐
│ Property 1/20 (ID: 006136)                                  │
├─────────────────────────────────────────────────────────────┤
│ Phase 1: Property APIs (3 calls, ~3s)                      │
│   ✓ Leases API    → 20 leases found                        │
│   ✓ Offers API    → 5 offers (cached)                      │
│   ✓ EMEA API      → 20 records (cached)                    │
│                                                             │
│ Phase 2: Lease Details (60 calls, ~40s)                    │
│   Lease 1/20:  Notes → Options → Charges  [wait 1s]        │
│   Lease 2/20:  Notes → Options → Charges  [wait 1s]        │
│   Lease 3/20:  Notes → Options → Charges  [wait 1s]        │
│   ...                                                       │
│   Lease 20/20: Notes → Options → Charges                   │
│                                                             │
│ ✅ Complete: 63 calls in 43 seconds                        │
└─────────────────────────────────────────────────────────────┘
⏸️ Wait 30 seconds before next property
```

### Property 2
```
┌─────────────────────────────────────────────────────────────┐
│ Property 2/20 (ID: 006146)                                  │
├─────────────────────────────────────────────────────────────┤
│ Phase 1: Property APIs (3 calls, ~3s)                      │
│   ✓ Leases API    → 20 leases found                        │
│   ✓ Offers API    → 3 offers (CACHED - no API call)        │
│   ✓ EMEA API      → 20 records (CACHED - no API call)      │
│                                                             │
│ Phase 2: Lease Details (60 calls, ~40s)                    │
│   Lease 1/20:  Notes → Options → Charges  [wait 1s]        │
│   Lease 2/20:  Notes → Options → Charges  [wait 1s]        │
│   ...                                                       │
│   Lease 20/20: Notes → Options → Charges                   │
│                                                             │
│ ✅ Complete: 61 calls in 43 seconds (2 cached)             │
└─────────────────────────────────────────────────────────────┘
⏸️ Wait 30 seconds before next property
```

### Properties 3-20
```
... Same pattern continues for remaining 18 properties
```

---

## Total Processing Summary

### Time Calculation

```
Per Property:
  Processing Time:  43 seconds
  Delay After:      30 seconds
  Total:            73 seconds per property

For 20 Properties:
  20 properties × 73 seconds = 1,460 seconds
  = 24.3 minutes
  ≈ 24-25 minutes total
```

### API Calls Calculation

```
Property 1 (no cache):
  Property APIs:  3 calls
  Lease APIs:     60 calls (20 leases × 3)
  Total:          63 calls

Properties 2-20 (with cache):
  Property APIs:  1 call (only Leases, Offers/EMEA cached)
  Lease APIs:     60 calls (20 leases × 3)
  Total:          61 calls per property
  
Total API Calls:
  Property 1:     63 calls
  Properties 2-20: 19 × 61 = 1,159 calls
  Grand Total:    1,222 calls
```

### Rate Limit Analysis

```
MRI Developer Key Limit: 100 calls per 5 minutes (300 seconds)

Our Pattern:
  Property 1:  63 calls in 43s  → Wait 30s → Total: 73s
  Property 2:  61 calls in 43s  → Wait 30s → Total: 73s
  Property 3:  61 calls in 43s  → Wait 30s → Total: 73s
  Property 4:  61 calls in 43s  → Wait 30s → Total: 73s
  
First 5 minutes (300 seconds):
  300s ÷ 73s per property = ~4.1 properties
  4 properties × ~62 calls = ~248 calls
  
❌ PROBLEM: 248 calls > 100 call limit!
```

---

## ⚠️ CRITICAL ISSUE IDENTIFIED

### The Problem

Even with our conservative approach, we're still exceeding the rate limit:
- **4 properties in 5 minutes = ~248 API calls**
- **MRI limit = 100 calls per 5 minutes**
- **We're 2.5× over the limit!**

### Why This Happens

Each property with 20 leases requires:
- 1 Leases API call
- 20 leases × 3 API calls = 60 lease detail calls
- Total: **61 calls per property**

In 5 minutes, we can process ~4 properties = **244 calls** (way over 100 limit)

---

## 🔧 SOLUTION: Increase Delays

### Option 1: Longer Delay Between Properties (Recommended)

```
Current: 30 seconds between properties
Needed:  150 seconds (2.5 minutes) between properties

Calculation:
  To stay under 100 calls per 5 minutes:
  100 calls ÷ 61 calls per property = 1.6 properties per 5 minutes
  300 seconds ÷ 1.6 = 187 seconds per property
  
  Processing time: 43 seconds
  Required delay: 187 - 43 = 144 seconds
  
  Safe delay: 150 seconds (2.5 minutes)
```

**New Timeline:**
```
Property 1:  43s processing + 150s delay = 193s
Property 2:  43s processing + 150s delay = 193s
...
Property 20: 43s processing

Total Time: (19 × 193s) + 43s = 3,710 seconds
          = 61.8 minutes
          ≈ 62 minutes (1 hour 2 minutes)
```

**Rate Limit Check:**
```
In 5 minutes (300 seconds):
  300s ÷ 193s per property = 1.55 properties
  1.55 × 61 calls = 94.5 calls
  
✅ 94.5 calls < 100 call limit - SAFE!
```

### Option 2: Reduce Leases Per Request

```
Instead of fetching all 20 leases at once:
  Fetch 5 leases per property call
  Process 4 separate "batches" per property
  
This spreads the load but takes much longer.
```

### Option 3: Skip Optional APIs

```
Only fetch critical data:
  ✓ Leases API (required)
  ✓ Offers API (required)
  ✓ EMEA API (required)
  ✗ Notes API (optional - skip)
  ✗ Options API (optional - skip)
  ✗ Charges API (optional - skip)

Calls per property: 3 + 0 = 3 calls
Time per property: ~5 seconds

Total for 20 properties:
  Time: ~5 minutes
  Calls: 60 calls
  
✅ Well under rate limit!
```

---

## 📊 Comparison Table

| Approach | Delay Between Properties | Total Time | API Calls | Rate Limit Safe? |
|----------|-------------------------|------------|-----------|------------------|
| **Current (30s)** | 30 seconds | 24 minutes | 1,222 | ❌ NO (248 calls/5min) |
| **Option 1 (150s)** | 150 seconds | 62 minutes | 1,222 | ✅ YES (95 calls/5min) |
| **Option 2 (Batched)** | 30 seconds | 45 minutes | 1,222 | ⚠️ MAYBE (needs testing) |
| **Option 3 (Minimal)** | 10 seconds | 5 minutes | 60 | ✅ YES (60 calls/5min) |

---

## 🎯 RECOMMENDED CONFIGURATION

### For Full Data (All APIs)

```typescript
// Update in leasing.service.ts
batchSize: 1
delayBetweenBatches: 150000  // 150 seconds (2.5 minutes)
```

**Pros:**
- ✅ Fetches all data (notes, options, charges)
- ✅ Stays under rate limit
- ✅ 100% success rate

**Cons:**
- ⏱️ Takes ~1 hour for 20 properties

### For Quick Sync (Essential Data Only)

```typescript
// Update in leasing.service.ts
batchSize: 1
delayBetweenBatches: 10000  // 10 seconds

// Skip optional APIs in mapLeaseToUpcomingRenewal
// Only fetch: Leases, Offers, EMEA
```

**Pros:**
- ⚡ Fast (~5 minutes)
- ✅ Stays under rate limit
- ✅ Gets essential renewal data

**Cons:**
- ❌ Missing notes, options, charges

---

## 💡 BEST PRACTICE RECOMMENDATION

### Hybrid Approach

1. **Quick Sync (Every 30 minutes)**
   - Fetch only essential data (Leases, Offers, EMEA)
   - Takes ~5 minutes
   - Keeps dashboard up-to-date

2. **Full Sync (Once per day at night)**
   - Fetch all data including notes, options, charges
   - Takes ~1 hour
   - Runs at 2 AM when no one is using the system

### Implementation

```typescript
// Quick sync endpoint
@Post('sync/quick')
async quickSync() {
  return this.service.queueRenewalsSync({
    batchSize: 1,
    delayBetweenBatches: 10000,
    skipOptionalAPIs: true,  // New flag
  });
}

// Full sync endpoint
@Post('sync/full')
async fullSync() {
  return this.service.queueRenewalsSync({
    batchSize: 1,
    delayBetweenBatches: 150000,
    skipOptionalAPIs: false,
  });
}
```

---

## 📈 Expected Logs (Full Sync)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Starting renewals sync job 1
📊 Total properties: 20
📦 Batch size: 1 property per batch
⏱️  Delay between batches: 150s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────────────────────────────┐
│ 📦 BATCH 1/20 - Processing 1 properties                    │
│ Properties: 006136                                          │
└─────────────────────────────────────────────────────────────┘
  ├─ [1/1] Processing property 006136...
  │  📞 API Call: Fetching leases for property 006136
  │  ✓ Found 20 leases for property 006136
  │  📞 API Call: Fetching offers and EMEA for property 006136
  │  ✓ Offers: 5, EMEA: 20
  │  📞 API Call: Fetching lease details for 20 leases (sequential)
  │  Processing lease 1/20: ABC123
  │    • Notes → Options → Charges
  │  Processing lease 2/20: DEF456
  │    • Notes → Options → Charges
  │  ...
  │  Processing lease 20/20: XYZ789
  │    • Notes → Options → Charges
  │  ✓ Success: 87 renewals found (43210ms)
  └─ Batch 1 complete: 87 renewals in 43.2s

📈 Progress: 1/20 properties | 87 total renewals | 0 errors

⏸️  Waiting 150s before batch 2/20 to respect rate limits...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

... (continues for all 20 properties)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Renewals sync job 1 COMPLETED
📊 Results:
   • Total renewals: 1,740
   • Properties processed: 20/20
   • Errors: 0
   • Duration: 3710.5s (61.8 minutes)
   • Success rate: 100.0%
   • API calls: 1,222 total
   • Rate: ~20 calls per minute (well under limit)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🚨 ACTION REQUIRED

**You must update the delay configuration to avoid rate limits:**

```typescript
// In src/modules/leasing/leasing.service.ts
// Line ~85

batchSize: options?.batchSize || 1,
delayBetweenBatches: options?.delayBetweenBatches || 150000, // Change from 30000 to 150000
```

**Or use the quick sync approach for faster results with less data.**
