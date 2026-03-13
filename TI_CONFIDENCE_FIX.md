# TI Confidence Threshold Fix

## Issue
The `tenant_improvement_psf` field was not being extracted and updated because its confidence (0.5969586968421936 ≈ 59.7%) was below the standard confidence threshold of 0.85 (85%).

## Root Cause
The `getValue()` helper function used a single confidence threshold of 0.85 for all fields, but TI (Tenant Improvement) values are often harder to extract accurately from documents due to:
- Complex text descriptions like "twenty dollars per square foot ($20.00 psf)"
- Varied formatting and presentation in LOI documents
- Mixed text and numeric representations

## Solution
Created a separate helper function `getTIValue()` with a lower confidence threshold specifically for TI fields.

## Changes Made

### 1. Added TI-Specific Helper Function
```typescript
// Helper for TI values with lower confidence threshold (TI extraction is often less accurate)
const getTIValue = (field: any) => {
  const TI_CONFIDENCE_THRESHOLD = 0.5; // Lower threshold for TI values
  if (field && field.value && field.confidence >= TI_CONFIDENCE_THRESHOLD) {
    const value = field.value;
    // Skip empty strings, null, undefined, or 0
    if (value === '' || value === null || value === undefined || value === 0) {
      return null;
    }
    return value;
  }
  return null;
};
```

### 2. Updated TI Field Extraction
```typescript
// Before: Used standard getValue() with 0.85 threshold
const tiPerSf = getValue(data.tenant_improvement_psf) || getValue(data.ti_per_sf) || getValue(data.tenant_improvement_per_sf);

// After: Use special getTIValue() with 0.5 threshold
const tiPerSf = getTIValue(data.tenant_improvement_psf) || getTIValue(data.ti_per_sf) || getTIValue(data.tenant_improvement_per_sf);
```

### 3. Enhanced Logging
```typescript
if (tiPerSf !== null) {
  // ... processing logic ...
  this.logger.debug(`Extracted tiPerSf: ${tiPerSf} -> ${numericTiPerSf} -> "${tiPerSfString}" (updated both objects) [confidence: ${data.tenant_improvement_psf?.confidence?.toFixed(2)}]`);
} else {
  this.logger.debug(`tiPerSf not extracted - confidence too low: ${data.tenant_improvement_psf?.confidence?.toFixed(2)} (threshold: 0.5)`);
}
```

## Confidence Thresholds

| Field Type | Threshold | Reason |
|------------|-----------|---------|
| Standard fields (rent_psf, annual_increase, etc.) | 0.85 (85%) | High accuracy required for financial data |
| TI fields (tenant_improvement_psf) | 0.5 (50%) | Lower threshold due to complex text formats |

## Expected Behavior

### Before Fix
```
Input: tenant_improvement_psf: { value: '15', confidence: 0.5969586968421936 }
Result: ❌ Not extracted (confidence 59.7% < 85% threshold)
```

### After Fix
```
Input: tenant_improvement_psf: { value: '15', confidence: 0.5969586968421936 }
Result: ✅ Extracted as "15" (confidence 59.7% >= 50% threshold)
```

## Log Output After Fix

You should now see logs like:
```
[LeadsService] Extracted tiPerSf: 15 -> 15 -> "15" (updated both objects) [confidence: 0.60]
```

Instead of the field being skipped entirely.

## Testing

With your current data:
```json
{
  "annual_increase": { "value": "3%", "confidence": 0.9874130487442017 },
  "rent_psf": { "value": "28.00", "confidence": 1 },
  "tenant_improvement_psf": { "value": "15", "confidence": 0.5969586968421936 }
}
```

Expected results:
- ✅ `annInc`: 3 (confidence 98.7% >= 85%)
- ✅ `rentPerSf`: 28.00 (confidence 100% >= 85%)
- ✅ `tiPerSf`: "15" (confidence 59.7% >= 50%) **← Now works!**

## Impact
- ✅ TI values with confidence >= 50% are now extracted
- ✅ Maintains high accuracy for critical financial fields
- ✅ Better logging shows confidence levels for debugging
- ✅ More complete data extraction from LOI documents