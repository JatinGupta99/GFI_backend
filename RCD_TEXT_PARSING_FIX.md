# RCD Text Parsing Fix - Enhanced Number Detection

## Issue
The `rent_commencement_date` field was receiving complex text descriptions that contain various numbers (120, 121, 122, etc.) representing days to add to the current date.

## Solution
Enhanced the `convertDateToYYMMDD()` helper function with a **flexible number detection** approach that:
1. **First Priority**: Finds ANY number in the text (120, 121, 122, etc.)
2. **Second Priority**: Uses specific patterns for context
3. **Third Priority**: Falls back to written numbers
4. Calculates future dates by adding days to the current date
5. Converts to YY/MM/DD format

## Number Detection Strategy

### 1. **Primary: Any Number Detection** (Most Flexible)
```typescript
const anyNumberMatch = dateString.match(/\b(\d{1,4})\b/);
```

This catches **any number** in the text:
- `"120 days after permits"` → 120
- `"121 days from approval"` → 121  
- `"The tenant has 122 days"` → 122
- `"Wait for 90 business days"` → 90
- `"After 365 calendar days"` → 365

**Range Validation**: Only accepts numbers between 1-3650 days (roughly 10 years max)

### 2. **Secondary: Pattern-Based Detection**
If no simple number found, tries specific patterns:

| Pattern | Example | Extracted |
|---------|---------|-----------|
| `(\d+)\s*days?\s*after` | "120 days after" | 120 |
| `\((\d+)\)\s*days?\s*after` | "(121) days after" | 121 |
| `\((\d+)\)` | "permits (122) days" | 122 |

### 3. **Tertiary: Written Numbers**
If no numeric patterns work, tries written numbers:

| Written Text | Numeric Value |
|--------------|---------------|
| "one hundred twenty" | 120 |
| "one hundred" | 100 |
| "ninety" | 90 |
| "sixty" | 60 |
| "thirty" | 30 |

## Processing Logic

```typescript
const convertDateToYYMMDD = (dateString: string): string => {
  // 1. Try regular date parsing first
  let date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    let daysToAdd: number | null = null;
    
    // 2. PRIMARY: Look for ANY number in text
    const anyNumberMatch = dateString.match(/\b(\d{1,4})\b/);
    if (anyNumberMatch) {
      const foundNumber = parseInt(anyNumberMatch[1]);
      if (foundNumber >= 1 && foundNumber <= 3650) {
        daysToAdd = foundNumber;
      }
    }
    
    // 3. SECONDARY: Try specific patterns if no number found
    if (!daysToAdd) {
      // ... pattern matching logic
    }
    
    // 4. TERTIARY: Try written numbers
    if (!daysToAdd) {
      // ... written number logic
    }
    
    // 5. Calculate future date
    if (daysToAdd) {
      date = new Date();
      date.setDate(date.getDate() + daysToAdd);
    }
  }
  
  // 6. Format as YY/MM/DD
  return formatDate(date);
};
```

## Example Transformations

### Various Number Formats
| Input Text | Number Found | Current Date | Result Date | YY/MM/DD |
|------------|--------------|--------------|-------------|----------|
| `"120 days after permits"` | 120 | 2026-03-13 | 2026-07-11 | 26/07/11 |
| `"121 days from approval"` | 121 | 2026-03-13 | 2026-07-12 | 26/07/12 |
| `"The tenant has 122 days"` | 122 | 2026-03-13 | 2026-07-13 | 26/07/13 |
| `"Wait 90 business days"` | 90 | 2026-03-13 | 2026-06-11 | 26/06/11 |
| `"After 365 calendar days"` | 365 | 2026-03-13 | 2027-03-13 | 27/03/13 |

### Complex Text Examples
| Input Text | Extracted | Result |
|------------|-----------|---------|
| `"one hundred twenty (120) days after Tenant receives its permits"` | 120 | 26/07/11 |
| `"The lease commences 121 days after final approval"` | 121 | 26/07/12 |
| `"Tenant must open within 122 days of permit issuance"` | 122 | 26/07/13 |
| `"Construction period: 180 days maximum"` | 180 | 26/09/09 |

### Edge Cases
| Input Text | Behavior | Result |
|------------|----------|---------|
| `"March 1, 2024"` | Regular date parsing | 24/03/01 |
| `"immediately upon completion"` | No number found | Original text |
| `"5000 days"` | Number too large (>3650) | Try other patterns |
| `"0 days"` | Number too small (<1) | Try other patterns |

## Log Output Examples

```
[LeadsService] Found number 120 in text, treating as days to add
[LeadsService] Parsed "120 days after permits" as 120 days from today -> 2026-07-11T10:30:00.000Z
[LeadsService] Extracted rcd: 120 days after permits -> 26/07/11 (updated both objects)

[LeadsService] Found number 121 in text, treating as days to add  
[LeadsService] Parsed "The tenant has 121 days" as 121 days from today -> 2026-07-12T10:30:00.000Z
[LeadsService] Extracted rcd: The tenant has 121 days -> 26/07/12 (updated both objects)
```

## Validation Rules

- **Minimum**: 1 day (prevents 0 or negative numbers)
- **Maximum**: 3650 days (roughly 10 years, prevents unrealistic values)
- **Format**: Only integers (no decimals)
- **Range**: 1-4 digits (`\d{1,4}`)

## Testing Scenarios

```bash
# Test various numbers
"120 days after permit approval"           → 120 days from today
"121 days from lease signing"             → 121 days from today  
"The tenant has 122 days to complete"     → 122 days from today
"Construction period: 180 days maximum"   → 180 days from today
"After 365 calendar days"                 → 365 days from today

# Edge cases
"March 1, 2024"                          → 24/03/01 (regular date)
"immediately upon completion"             → original text (no number)
"5000 days"                              → original text (too large)
```

## Impact
- ✅ **Universal Number Detection**: Catches any number (120, 121, 122, etc.) in text
- ✅ **Flexible Parsing**: Works with various text formats and contexts
- ✅ **Smart Validation**: Only accepts reasonable day ranges (1-3650)
- ✅ **Fallback Support**: Multiple parsing strategies for maximum coverage
- ✅ **Maintains Compatibility**: Still handles regular dates and written numbers