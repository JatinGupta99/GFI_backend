# References Field Fix - PATCH Request

## 🐛 Issue

The PATCH request was failing because the frontend was sending `references` as an object with numeric keys instead of an array.

**Problematic Request Data:**
```json
{
  "references": {
    "0": {
      "bankReference": "First National Bank",
      "bankOfficerName": "Sarah Johnson",
      "bankOfficerPhone": "+1-555-0130",
      "professionalReference1": {
        "name": "Michael Smith",
        "phone": "+1-555-0131"
      },
      "professionalReference2": {
        "name": "Emily Brown",
        "phone": "+1-555-0132"
      }
    },
    "bankOfficerName": "1"  // ❌ This is wrong - duplicate field
  }
}
```

## ✅ Solution

Updated the `update` method in `leads.service.ts` to handle **3 different formats**:

1. **Array format** (correct format) - Use as-is
2. **Object with numeric keys** (your current frontend format) - Convert to array
3. **Single object** (fallback) - Wrap in array

## 📋 Supported Formats

### Format 1: Array (Recommended) ✅
```json
{
  "references": [
    {
      "bankReference": "First National Bank",
      "bankOfficerName": "Sarah Johnson",
      "bankOfficerPhone": "+1-555-0130",
      "professionalReference1": {
        "name": "Michael Smith",
        "phone": "+1-555-0131"
      },
      "professionalReference2": {
        "name": "Emily Brown",
        "phone": "+1-555-0132"
      }
    }
  ]
}
```

### Format 2: Object with Numeric Keys (Now Supported) ✅
```json
{
  "references": {
    "0": {
      "bankReference": "First National Bank",
      "bankOfficerName": "Sarah Johnson",
      "bankOfficerPhone": "+1-555-0130",
      "professionalReference1": {
        "name": "Michael Smith",
        "phone": "+1-555-0131"
      },
      "professionalReference2": {
        "name": "Emily Brown",
        "phone": "+1-555-0132"
      }
    }
  }
}
```

### Format 3: Single Object (Now Supported) ✅
```json
{
  "references": {
    "bankReference": "First National Bank",
    "bankOfficerName": "Sarah Johnson",
    "bankOfficerPhone": "+1-555-0130",
    "professionalReference1": {
      "name": "Michael Smith",
      "phone": "+1-555-0131"
    },
    "professionalReference2": {
      "name": "Emily Brown",
      "phone": "+1-555-0132"
    }
  }
}
```

## 🔧 How It Works

The update method now:

1. **Checks if references is an array** → Use as-is
2. **Checks if references is an object with numeric keys** (like "0", "1") → Convert to array
3. **Checks if references is a single object** → Wrap in array

```typescript
// Handle references conversion - support both array and object formats
if (normalizedData.references) {
  if (Array.isArray(normalizedData.references)) {
    // Already an array, use as-is
    normalizedData.references = normalizedData.references;
  } else if (typeof normalizedData.references === 'object') {
    // Convert object with numeric keys to array
    const referencesObj = normalizedData.references as any;
    const numericKeys = Object.keys(referencesObj)
      .filter(key => !isNaN(Number(key))) // Only numeric keys like "0", "1", etc.
      .sort((a, b) => Number(a) - Number(b));
    
    if (numericKeys.length > 0) {
      // Object with numeric keys - convert to array
      normalizedData.references = numericKeys.map(key => referencesObj[key]);
    } else {
      // Single reference object - wrap in array
      normalizedData.references = [referencesObj];
    }
  }
}
```

## 🧪 Testing

### Test with cURL (Format 1 - Array)
```bash
curl -X PATCH "http://localhost:4020/api/leasing/active-leads/69a49b8f4a4f3730af4d3b52" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "references": [
      {
        "bankReference": "First National Bank",
        "bankOfficerName": "Sarah Johnson",
        "bankOfficerPhone": "+1-555-0130",
        "professionalReference1": {
          "name": "Michael Smith",
          "phone": "+1-555-0131"
        },
        "professionalReference2": {
          "name": "Emily Brown",
          "phone": "+1-555-0132"
        }
      }
    ]
  }'
```

### Test with cURL (Format 2 - Object with Numeric Keys)
```bash
curl -X PATCH "http://localhost:4020/api/leasing/active-leads/69a49b8f4a4f3730af4d3b52" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "references": {
      "0": {
        "bankReference": "First National Bank",
        "bankOfficerName": "Sarah Johnson",
        "bankOfficerPhone": "+1-555-0130",
        "professionalReference1": {
          "name": "Michael Smith",
          "phone": "+1-555-0131"
        },
        "professionalReference2": {
          "name": "Emily Brown",
          "phone": "+1-555-0132"
        }
      }
    }
  }'
```

### Test with cURL (Format 3 - Single Object)
```bash
curl -X PATCH "http://localhost:4020/api/leasing/active-leads/69a49b8f4a4f3730af4d3b52" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "references": {
      "bankReference": "First National Bank",
      "bankOfficerName": "Sarah Johnson",
      "bankOfficerPhone": "+1-555-0130",
      "professionalReference1": {
        "name": "Michael Smith",
        "phone": "+1-555-0131"
      },
      "professionalReference2": {
        "name": "Emily Brown",
        "phone": "+1-555-0132"
      }
    }
  }'
```

## 🎯 Your Original Request - Fixed

**Original (Problematic):**
```json
{
  "references": {
    "0": {
      "bankReference": "First National Bank",
      "bankOfficerName": "Sarah Johnson",
      "bankOfficerPhone": "+1-555-0130",
      "professionalReference1": {
        "name": "Michael Smith",
        "phone": "+1-555-0131"
      },
      "professionalReference2": {
        "name": "Emily Brown",
        "phone": "+1-555-0132"
      }
    },
    "bankOfficerName": "1"  // ❌ Remove this
  }
}
```

**Fixed (Remove the duplicate bankOfficerName):**
```json
{
  "references": {
    "0": {
      "bankReference": "First National Bank",
      "bankOfficerName": "Sarah Johnson",
      "bankOfficerPhone": "+1-555-0130",
      "professionalReference1": {
        "name": "Michael Smith",
        "phone": "+1-555-0131"
      },
      "professionalReference2": {
        "name": "Emily Brown",
        "phone": "+1-555-0132"
      }
    }
  }
}
```

## 💡 Frontend Recommendation

While the backend now supports all formats, it's recommended to update your frontend to send `references` as an **array** for consistency:

```typescript
// Frontend code example
const updateLead = async (leadId: string, data: any) => {
  // Ensure references is an array
  if (data.references && !Array.isArray(data.references)) {
    data.references = [data.references];
  }
  
  const response = await fetch(`/api/leasing/active-leads/${leadId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  
  return response.json();
};
```

## ✅ Status

**Fixed:** ✅ Backend now handles all 3 formats  
**Backward Compatible:** ✅ Existing code continues to work  
**Recommended:** Update frontend to use array format

## 📚 Related Files

- `src/modules/leads/leads.service.ts` - Updated update method
- `src/modules/leads/schema/sub-schemas/reference.schema.ts` - Schema definition
- `src/modules/leads/schema/lead.schema.ts` - Lead schema

---

**Last Updated:** 2026-03-01  
**Status:** Production Ready ✅
