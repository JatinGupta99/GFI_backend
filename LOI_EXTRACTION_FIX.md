# LOI Extraction Fix - Budget Negotiation Update

## Issue
The LOI Document AI extraction was only updating `current_negotiation` fields but not `budget_negotiation` fields, even though the extracted values should populate both objects.

## Root Cause
The `updateWithLoiExtraction` method in `src/modules/leads/leads.service.ts` was only updating the `current_negotiation` object and ignoring `budget_negotiation`.

## Solution
Modified the LOI extraction logic to update **both** `current_negotiation` and `budget_negotiation` with the same extracted values, including proper data type conversion and date formatting.

## Field Mappings

Based on Document AI extraction results, the following mappings are applied:

| Document AI Field | Schema Field | Conversion | Example |
|-------------------|--------------|------------|---------|
| `annual_increase` | `annInc` | Remove % and convert to number | `"15%"` → `15` |
| `rent_psf` | `rentPerSf` | Convert to number | `"35.00"` → `35.00` |
| `tenant_improvement_psf` | `tiPerSf` | Extract $ value and convert to string | `"twenty dollars per square foot ($20.00 psf)"` → `"20"` |
| `rent_commencement_date` | `rcd` | Convert to YY/MM/DD format | `"March 1, 2024"` → `"24/03/01"` |

## Changes Made

### 1. Initialize Both Objects
```typescript
// Before: Only current_negotiation
if (!lead.current_negotiation) lead.current_negotiation = {} as any;

// After: Both objects
if (!lead.current_negotiation) lead.current_negotiation = {} as any;
if (!lead.budget_negotiation) lead.budget_negotiation = {} as any;
```

### 2. Date Conversion Helper
```typescript
const convertDateToYYMMDD = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      this.logger.warn(`Invalid date format: ${dateString}`);
      return dateString; // Return original if can't parse
    }
    
    const year = date.getFullYear().toString().slice(-2); // Last 2 digits of year
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Month with leading zero
    const day = date.getDate().toString().padStart(2, '0'); // Day with leading zero
    
    return `${year}/${month}/${day}`;
  } catch (error) {
    this.logger.warn(`Error converting date ${dateString}:`, error);
    return dateString; // Return original if error
  }
};
```

### 3. Enhanced Value Processing

#### Annual Increase (Percentage Handling)
```typescript
if (annInc !== null) {
  // Handle percentage values like "15%" - extract numeric value
  const numericAnnInc = typeof annInc === 'string' && annInc.includes('%') 
    ? parseFloat(annInc.replace('%', '')) 
    : parseFloat(annInc);
  
  lead.current_negotiation.annInc = numericAnnInc;
  lead.budget_negotiation.annInc = numericAnnInc;
  hasUpdates = true;
  this.logger.debug(`Extracted annInc: ${annInc} -> ${numericAnnInc} (updated both objects)`);
}
```

#### Tenant Improvement (Text Parsing)
```typescript
if (tiPerSf !== null) {
  // Handle text values like "twenty dollars per square foot ($20.00 psf)" - extract numeric value
  let numericTiPerSf = tiPerSf;
  if (typeof tiPerSf === 'string') {
    // Try to extract number from parentheses like ($20.00 psf)
    const match = tiPerSf.match(/\$(\d+\.?\d*)/);
    if (match) {
      numericTiPerSf = parseFloat(match[1]);
    } else {
      // Try to parse as float directly
      numericTiPerSf = parseFloat(tiPerSf) || 0;
    }
  }
  
  // Convert to string as per schema requirement (tiPerSf is string type)
  const tiPerSfString = numericTiPerSf.toString();
  lead.current_negotiation.tiPerSf = tiPerSfString;
  lead.budget_negotiation.tiPerSf = tiPerSfString;
  hasUpdates = true;
  this.logger.debug(`Extracted tiPerSf: ${tiPerSf} -> ${numericTiPerSf} -> "${tiPerSfString}" (updated both objects)`);
}
```

#### Rent Commencement Date (Date Formatting)
```typescript
if (rcd !== null) {
  // Convert date to YY/MM/DD format
  const formattedRcd = convertDateToYYMMDD(rcd);
  lead.current_negotiation.rcd = formattedRcd;
  lead.budget_negotiation.rcd = formattedRcd;
  hasUpdates = true;
  this.logger.debug(`Extracted rcd: ${rcd} -> ${formattedRcd} (updated both objects)`);
}
```

### 4. Save Both Objects
```typescript
// Before: Only current_negotiation
if (hasUpdates) {
  updatePayload.current_negotiation = lead.current_negotiation;
}

// After: Both objects
if (hasUpdates) {
  updatePayload.current_negotiation = lead.current_negotiation;
  updatePayload.budget_negotiation = lead.budget_negotiation;
}
```

## Expected Behavior After Fix

When Document AI extracts values from an LOI:

### Input (Document AI Results)
```json
{
  "annual_increase": {"value": "15%", "confidence": 0.878082275390625},
  "rent_commencement_date": {"value": "March 1, 2024", "confidence": 0.9787043929100037},
  "rent_psf": {"value": "35.00", "confidence": 0.9984940886497498},
  "tenant_improvement_psf": {"value": "twenty dollars per square foot ($20.00 psf)", "confidence": 0.5660712122917175}
}
```

### Output (Database Update)
```json
{
  "current_negotiation": {
    "rentPerSf": 35.00,
    "annInc": 15,
    "tiPerSf": "20",
    "rcd": "24/03/01"
  },
  "budget_negotiation": {
    "rentPerSf": 35.00,
    "annInc": 15,
    "tiPerSf": "20",
    "rcd": "24/03/01"
  }
}
```

## Testing

To test the fix:

1. **Upload an LOI document** with clear rent, annual increase, TI, and RCD values
2. **Check the logs** for extraction confirmation
3. **Verify database** that both `current_negotiation` and `budget_negotiation` are updated
4. **Check frontend** that both objects show the extracted values with proper formatting

## Log Output After Fix

You should see logs like:
```
[LeadsService] Extracted rentPerSf: 35.00 -> 35 (updated both objects)
[LeadsService] Extracted annInc: 15% -> 15 (updated both objects)
[LeadsService] Extracted tiPerSf: twenty dollars per square foot ($20.00 psf) -> 20 -> "20" (updated both objects)
[LeadsService] Extracted rcd: March 1, 2024 -> 24/03/01 (updated both objects)
[LeadsService] Updated both current_negotiation and budget_negotiation with extracted values
```

## Impact
- ✅ Both negotiation objects now get populated from LOI extraction
- ✅ Proper data type conversion (number/string as per schema)
- ✅ Date formatting to YY/MM/DD format
- ✅ Enhanced value parsing for percentages and text descriptions
- ✅ Enhanced logging for debugging
- ✅ Consistent data across current and budget negotiations