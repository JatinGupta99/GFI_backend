# Renewal Notes API Documentation

## Overview
The Renewal Notes API allows you to manage commercial lease notes for upcoming renewals using the MRI `MRI_S-PMCM_CommercialLeasesNoteByBuildingID` stored procedure.

## Features
- Fetch commercial lease notes from MRI
- Create new renewal notes
- Notes are automatically displayed in the upcoming renewals list
- Most recent note is shown in the `note` field of each renewal

## Endpoints

### 1. Get Upcoming Renewals (with Notes)
Fetch upcoming renewals for a property. The `note` field now contains the most recent commercial lease note.

**Endpoint:** `GET /api/leasing/renewals`

**Query Parameters:**
- `propertyId` (required) - Property/Building ID
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 50)

**Example Request:**
```bash
curl -X GET 'http://localhost:4020/api/leasing/renewals?propertyId=BAYO&page=1&limit=20' \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "ST1633",
      "tenant": "ABC Company",
      "property": "Bay Office Building",
      "suite": "Suite 100",
      "sf": 5000,
      "expDate": "2026-12-31",
      "option": "Yes",
      "optionTerm": "Option 1: 60 months",
      "rentPerSf": 25.50,
      "ti": "N/A",
      "lcd": "N/A",
      "budgetSf": 5000,
      "budgetRent": 0,
      "budgetLcd": "N/A",
      "status": "Renewal Negotiation",
      "note": "Renewal discussion scheduled for next week. Tenant interested in 5-year extension."
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20
  }
}
```

### 2. Add Renewal Note
Create a new note for a commercial lease.

**Endpoint:** `POST /api/leasing/renewals/:buildingId/:leaseId/notes`

**Path Parameters:**
- `buildingId` (required) - Building/Property ID
- `leaseId` (required) - Lease ID

**Request Body:**
```json
{
  "noteText": "Renewal discussion scheduled for next week",
  "noteReference1": "RENEWAL",
  "noteReference2": "*"
}
```

**Body Parameters:**
- `noteText` (required) - The note text
- `noteReference1` (optional) - Note reference type 1 (default: 'RENEWAL')
- `noteReference2` (optional) - Note reference type 2 (default: '*')

**Example Request:**
```bash
curl -X POST 'http://localhost:4020/api/leasing/renewals/BAYO/ST1633/notes' \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "noteText": "Tenant requested 5-year renewal with 3% annual increases. Negotiation in progress.",
    "noteReference1": "RENEWAL",
    "noteReference2": "*"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "message": "Renewal note added successfully",
  "data": {
    "BuildingID": "BAYO",
    "LeaseID": "ST1633",
    "NoteDate": "2026-02-27T12:00:00.0000000",
    "NoteText": "Tenant requested 5-year renewal with 3% annual increases. Negotiation in progress.",
    "NoteReference1": "RENEWAL",
    "NoteReference2": "*",
    "LastUpdate": "2026-02-27T12:00:00.0000000",
    "UserID": "INT_WSUSER"
  }
}
```

### 3. Get All Notes for a Lease
Retrieve all notes for a specific commercial lease.

**Endpoint:** `GET /api/leasing/renewals/:buildingId/:leaseId/notes`

**Path Parameters:**
- `buildingId` (required) - Building/Property ID
- `leaseId` (required) - Lease ID

**Example Request:**
```bash
curl -X GET 'http://localhost:4020/api/leasing/renewals/BAYO/ST1633/notes' \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**
```json
{
  "data": [
    {
      "BuildingID": "BAYO",
      "LeaseID": "ST1633",
      "NoteDate": "2026-02-27T12:00:00.0000000",
      "NoteText": "Tenant requested 5-year renewal with 3% annual increases.",
      "NoteReference1": "RENEWAL",
      "NoteReference2": "*",
      "LastUpdate": "2026-02-27T12:00:00.0000000",
      "UserID": "INT_WSUSER"
    },
    {
      "BuildingID": "BAYO",
      "LeaseID": "ST1633",
      "NoteDate": "2026-02-20T10:30:00.0000000",
      "NoteText": "Initial renewal discussion held. Tenant interested in extending.",
      "NoteReference1": "RENEWAL",
      "NoteReference2": "*",
      "LastUpdate": "2026-02-20T10:30:00.0000000",
      "UserID": "INT_WSUSER"
    }
  ],
  "meta": {
    "total": 2,
    "buildingId": "BAYO",
    "leaseId": "ST1633"
  }
}
```

## Note Reference Types

### Common Reference Types
- `RENEWAL` - Renewal-related notes
- `01DATES` - Date-related notes
- `*` - Wildcard/general reference
- `@` - General note marker

Use the `MRI_S-PMCM_ReferenceTypes` API to get the complete list of valid reference types for your MRI instance.

## How Notes Appear in Renewals

When you fetch upcoming renewals using `GET /api/leasing/renewals`, the system:

1. Fetches all commercial lease notes for each lease
2. Sorts notes by `LastUpdate` date (most recent first)
3. Displays the most recent note text in the `note` field

This means the renewal list always shows the latest note for each lease automatically.

## Date Formats

### Input (Creating Notes)
- `NoteDate` is automatically set to current timestamp in ISO format
- Format: `2026-02-27T12:00:00.0000000`

### Output (Reading Notes)
- `NoteDate`: `2026-02-27T12:00:00.0000000`
- `LastUpdate`: `2026-02-27T12:00:00.0000000`

## Error Handling

### Common Errors

**400 Bad Request**
```json
{
  "statusCode": 400,
  "message": "noteText should not be empty",
  "error": "Bad Request"
}
```

**401 Unauthorized**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**503 Service Unavailable**
```json
{
  "statusCode": 503,
  "message": "MRI API Unreachable"
}
```

## Integration with MRI

### MRI Stored Procedure
`MRI_S-PMCM_CommercialLeasesNoteByBuildingID`

### Operations
- **GET** - Fetch notes with filters (BLDGID, LEASEID, date filters)
- **POST** - Create new note

### Retry Logic
The service includes automatic retry logic for:
- HTTP 500 errors
- Database deadlocks
- Network timeouts

Retries: 3 attempts with exponential backoff (1s, 2s, 3s)

## Best Practices

1. **Use Descriptive Notes**: Include relevant details about renewal discussions, tenant requests, and negotiation status

2. **Reference Types**: Use consistent reference types (e.g., 'RENEWAL' for all renewal-related notes)

3. **Regular Updates**: Add notes after each significant interaction with the tenant

4. **Check Existing Notes**: Use the GET notes endpoint to review history before adding new notes

5. **Error Handling**: Always handle potential MRI API errors in your application

## Example Workflow

### Complete Renewal Note Management Flow

```bash
# 1. Get upcoming renewals (includes latest note)
curl -X GET 'http://localhost:4020/api/leasing/renewals?propertyId=BAYO' \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 2. Add a new renewal note
curl -X POST 'http://localhost:4020/api/leasing/renewals/BAYO/ST1633/notes' \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "noteText": "Tenant agreed to 5-year renewal. Preparing lease documents."
  }'

# 3. Get all notes for the lease (to see history)
curl -X GET 'http://localhost:4020/api/leasing/renewals/BAYO/ST1633/notes' \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 4. Refresh renewals list (will show the new note)
curl -X GET 'http://localhost:4020/api/leasing/renewals?propertyId=BAYO' \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Service Layer Usage

If you need to use the service directly in your code:

```typescript
import { LeasingService } from './modules/leasing/leasing.service';

@Injectable()
export class YourService {
  constructor(private readonly leasingService: LeasingService) {}

  async addNote() {
    // Add a renewal note
    const note = await this.leasingService.addRenewalNote(
      'BAYO',
      'ST1633',
      'Tenant requested 5-year renewal',
      'RENEWAL',
      '*'
    );

    // Get all notes
    const notes = await this.leasingService.getRenewalNotes('BAYO', 'ST1633');
  }
}
```

## Logging

All operations are logged with:
- Request parameters
- Response data
- Duration
- Error details (if any)

Check application logs for detailed information about note operations.
