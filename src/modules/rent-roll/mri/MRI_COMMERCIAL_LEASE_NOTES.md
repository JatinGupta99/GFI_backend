# MRI Commercial Lease Notes Service

## Overview
Service for managing commercial lease notes using the MRI API stored procedure `MRI_S-PMCM_CommercialLeasesNoteByBuildingID`.

This service is specifically designed for **upcoming renewals** and commercial lease note management.

## API Reference

### Stored Procedure
`MRI_S-PMCM_CommercialLeasesNoteByBuildingID`

### Query Parameters (GET)
- `BLDGID` - Building ID (required)
- `LEASEID` - Lease ID (optional)
- `LASTUPDATEDATE` - Include only records modified since this date (optional)
- `OLDESTNOTEDATE` - Include only records created since this date (optional)

### Input Parameters (POST)
- `BuildingID` - Building ID of the lease
- `LeaseID` - Lease ID of the lease
- `NoteDate` - Date the note was generated
- `NoteText` - The text of the note (optional)
- `NoteReference1` - Note Reference Type
- `NoteReference2` - Note Reference Type

## Service Methods

### `fetch(params: FetchCommercialLeaseNotesParams)`
Fetch commercial lease notes with optional filters.

**Parameters:**
```typescript
{
  BLDGID: string;        // Required
  LEASEID?: string;      // Optional
  LASTUPDATEDATE?: string; // Optional - format: "YYYY-MM-DD HH:mm:ss.SSS"
  OLDESTNOTEDATE?: string; // Optional - format: "YYYY-MM-DD HH:mm:ss.SSS"
}
```

**Example:**
```typescript
const notes = await mriCommercialLeaseNotesService.fetch({
  BLDGID: 'BAYO',
  LEASEID: 'ST1633'
});
```

### `create(noteData: CreateCommercialLeaseNoteDto)`
Create a new commercial lease note.

**Parameters:**
```typescript
{
  BuildingID: string;
  LeaseID: string;
  NoteDate: string;      // Format: "YYYY-MM-DDTHH:mm:ss.SSSSSSS"
  NoteText?: string;
  NoteReference1: string;
  NoteReference2: string;
}
```

**Example:**
```typescript
const note = await mriCommercialLeaseNotesService.create({
  BuildingID: 'TSTBLG',
  LeaseID: 'TST000',
  NoteDate: '2026-02-27T00:00:00.0000000',
  NoteText: 'Renewal discussion scheduled for next week',
  NoteReference1: '01DATES',
  NoteReference2: '*'
});
```

### `fetchByLease(buildingId: string, leaseId: string)`
Convenience method to fetch notes for a specific lease.

**Example:**
```typescript
const notes = await mriCommercialLeaseNotesService.fetchByLease('BAYO', 'ST1633');
```

### `fetchRecentUpdates(buildingId: string, since: Date)`
Fetch notes modified since a specific date.

**Example:**
```typescript
const lastWeek = new Date();
lastWeek.setDate(lastWeek.getDate() - 7);
const recentNotes = await mriCommercialLeaseNotesService.fetchRecentUpdates('BAYO', lastWeek);
```

### `fetchRecentNotes(buildingId: string, since: Date)`
Fetch notes created since a specific date.

**Example:**
```typescript
const lastMonth = new Date();
lastMonth.setMonth(lastMonth.getMonth() - 1);
const newNotes = await mriCommercialLeaseNotesService.fetchRecentNotes('BAYO', lastMonth);
```

## Response Format

```typescript
interface MriCommercialLeaseNote {
  BuildingID: string;
  LeaseID: string;
  NoteDate: string;
  NoteText: string;
  NoteReference1: string;
  NoteReference2: string;
  LastUpdate: string;
  UserID: string;
}
```

## Usage in Leasing Module

### Example: Add Note for Upcoming Renewal

```typescript
import { MriCommercialLeaseNotesService } from '../rent-roll/mri/mri-commercial-lease-notes.service';

@Injectable()
export class LeasingService {
  constructor(
    private readonly mriCommercialLeaseNotesService: MriCommercialLeaseNotesService
  ) {}

  async addRenewalNote(buildingId: string, leaseId: string, noteText: string) {
    const note = await this.mriCommercialLeaseNotesService.create({
      BuildingID: buildingId,
      LeaseID: leaseId,
      NoteDate: new Date().toISOString(),
      NoteText: noteText,
      NoteReference1: 'RENEWAL',
      NoteReference2: '*'
    });
    
    return note;
  }

  async getRenewalNotes(buildingId: string, leaseId: string) {
    return this.mriCommercialLeaseNotesService.fetchByLease(buildingId, leaseId);
  }
}
```

## Note Reference Types

Use the `MRI_S-PMCM_ReferenceTypes` API to get valid reference type values for `NoteReference1` and `NoteReference2`.

Common reference types:
- `01DATES` - Date-related notes
- `RENEWAL` - Renewal-related notes
- `*` - Wildcard/general reference

## Date Formats

### Input Dates (for queries)
- `LASTUPDATEDATE`: `"2009-03-20 14:55:32.000"`
- `OLDESTNOTEDATE`: `"2009-03-20 14:55:32.000"`

### Note Date (for creation)
- `NoteDate`: `"2001-01-01T00:00:00.0000000"`

## Error Handling

The service includes automatic retry logic for:
- HTTP 500 errors
- Database deadlocks
- Network timeouts

Retries: 3 attempts with exponential backoff (1s, 2s, 3s)

## Logging

All operations are logged with:
- Request parameters
- Response data (first record sample)
- Duration
- Error details (if any)

Log format:
- 🔵 API Call initiated
- ✅ Success with duration
- ⚠️ Retry attempt
- ❌ Final failure
