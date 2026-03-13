# AR Balances Summary API

## Endpoint
`GET /api/renewals/ar-balances/summary`

## Description
Returns AR (Accounts Receivable) balances grouped by property from the renewal schema. The API calculates total AR balance from multiple fields in the renewal records.

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `propertyIds` | `string[]` | No | Array of property IDs to filter results |

## Request Examples

### Get AR balances for all properties
```bash
curl 'http://localhost:4020/api/renewals/ar-balances/summary' \
  -H 'Accept: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE'
```

### Get AR balances for specific properties
```bash
curl 'http://localhost:4020/api/renewals/ar-balances/summary?propertyIds=006146&propertyIds=008214' \
  -H 'Accept: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE'
```

### Get AR balances for single property
```bash
curl 'http://localhost:4020/api/renewals/ar-balances/summary?propertyIds=006146' \
  -H 'Accept: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE'
```

## Response Format

```json
{
  "success": true,
  "data": [
    {
      "propertyName": "Sunrise West",
      "totalArBalance": 15750.50
    },
    {
      "propertyName": "Midpoint Plaza",
      "totalArBalance": 8920.25
    },
    {
      "propertyName": "Commerce Center",
      "totalArBalance": 0
    }
  ],
  "meta": {
    "totalProperties": 3,
    "cached": false,
    "timestamp": "2026-03-13T10:30:45.123Z"
  }
}
```

## AR Balance Calculation

The `totalArBalance` is calculated by summing the following fields from the renewal schema:
- `totalArBalance` - Direct AR balance field
- `balanceDue` - Outstanding balance due
- `days0To30` - AR aged 0-30 days
- `days31To60` - AR aged 31-60 days  
- `days61Plus` - AR aged 61+ days

## Response Fields

### Data Array
Each object in the data array contains:

| Field | Type | Description |
|-------|------|-------------|
| `propertyName` | `string` | Name of the property |
| `totalArBalance` | `number` | Total AR balance for the property |

### Meta Object
| Field | Type | Description |
|-------|------|-------------|
| `totalProperties` | `number` | Number of properties in the response |
| `cached` | `boolean` | Whether the data was served from cache |
| `timestamp` | `string` | ISO timestamp of the response |

## Use Cases

1. **Property Management Dashboard**: Display AR balances by property
2. **Financial Reporting**: Generate AR summary reports
3. **Collections Management**: Identify properties with outstanding balances
4. **Executive Summary**: High-level AR overview across portfolio

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Invalid property ID format",
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

## Performance Notes

- Results are cached for 10 minutes for better performance
- Large property portfolios may take longer to process
- Consider pagination for very large datasets (future enhancement)

## Related Endpoints

- `GET /api/renewals/ar-balances/by-property` - Detailed AR balances with tenant breakdown
- `GET /api/renewals` - Full renewal records with filtering
- `GET /api/renewals/property/:propertyId` - Renewals for specific property