# Renewal Status Update Implementation

## Changes Made

### 1. Added New RenewalStatus Enum
Added `RenewalStatus` enum to `src/common/enums/common-enums.ts` with all status values:
- `DRAFTING_AMENDMENT`
- `OUT_FOR_EXECUTION` 
- `DRAFTING_LEASE`
- `DEAD`
- `NO_CONTACT`
- `AMENDMENT_EXECUTED`
- `SEND_ATTORNEY_NOTICE` ✨ NEW
- `SEND_COURTESY_NOTICE` ✨ NEW  
- `SEND_THREE_DAY_NOTICE` ✨ NEW

### 2. Updated Renewal Entity
- Updated `src/modules/renewals/renewal.entity.ts` to use the centralized `RenewalStatus` enum
- Changed status field type from `string` to `RenewalStatus`

### 3. Enhanced Controller
Updated `src/modules/renewals/renewals.controller.ts` to support:
- `renewal_status` query parameter (new)
- `ALL_NOTICES` status group filter ✨ NEW
- Backward compatibility with existing `status` parameter
- Proper enum validation and documentation

### 4. Updated Repository Mappings
Enhanced `src/modules/leasing/repository/renewal.repository.ts`:
- Added mapping for new status values in `mapStatus()` method
- Added reverse mapping in `unmapStatus()` method

### 5. Updated DTOs
- Updated `src/modules/renewals/dto/update-renewal-status.dto.ts` to use centralized enum

### 6. Fixed Type Issues
- Fixed TypeScript error in `src/modules/leads/leads.service.ts` by properly casting string to `RenewalStatus` enum

## API Usage Examples

### Filter by Status Groups (New)
```bash
# Filter by ALL notice statuses (Attorney, Courtesy, Three-Day)
curl 'http://localhost:4020/api/renewals?status=ALL_NOTICES'

# Filter by ALL notices with property
curl 'http://localhost:4020/api/renewals?property=006146&status=ALL_NOTICES'

# Filter by ALL notices with pagination
curl 'http://localhost:4020/api/renewals?status=ALL_NOTICES&page=1&limit=20'
```

### Filter by Individual Renewal Status
```bash
# Filter by single renewal status
curl 'http://localhost:4020/api/renewals?renewal_status=SEND_ATTORNEY_NOTICE'

# Filter by property and renewal status
curl 'http://localhost:4020/api/renewals?property=006146&renewal_status=SEND_COURTESY_NOTICE'

# Filter by ALL notices using renewal_status parameter
curl 'http://localhost:4020/api/renewals?renewal_status=ALL_NOTICES'
```

### Backward Compatibility (Existing)
```bash
# Still works with existing status parameter
curl 'http://localhost:4020/api/renewals?status=DRAFTING_AMENDMENT'

# Property filtering still works both ways
curl 'http://localhost:4020/api/renewals?property=006146'
curl 'http://localhost:4020/api/renewals?propertyIds=006146,008214'
```

### Update Renewal Status
```bash
# Update renewal status using PATCH endpoint
curl -X PATCH 'http://localhost:4020/api/renewals/{id}/status' \
  -H 'Content-Type: application/json' \
  -d '{"status": "SEND_ATTORNEY_NOTICE"}'
```

## Available Status Values

| Status | Description |
|--------|-------------|
| `DRAFTING_AMENDMENT` | Renewal negotiation in progress |
| `OUT_FOR_EXECUTION` | Documents sent for execution |
| `DRAFTING_LEASE` | New lease being drafted |
| `DEAD` | Renewal opportunity closed |
| `NO_CONTACT` | Unable to reach tenant |
| `AMENDMENT_EXECUTED` | Renewal completed |
| `SEND_ATTORNEY_NOTICE` | Legal notice required |
| `SEND_COURTESY_NOTICE` | Courtesy notice to be sent |
| `SEND_THREE_DAY_NOTICE` | Three-day notice required |

## Status Groups

| Group | Includes |
|-------|----------|
| `ALL_NOTICES` | `SEND_ATTORNEY_NOTICE`, `SEND_COURTESY_NOTICE`, `SEND_THREE_DAY_NOTICE` |

## Testing

Test the new functionality with:
```bash
# Test ALL_NOTICES group filter
curl 'http://localhost:4020/api/renewals?status=ALL_NOTICES&page=1&limit=5'

# Test individual notice status
curl 'http://localhost:4020/api/renewals?renewal_status=SEND_ATTORNEY_NOTICE'

# Test combined filters
curl 'http://localhost:4020/api/renewals?property=006146&status=ALL_NOTICES'

# Test status update
curl -X PATCH 'http://localhost:4020/api/renewals/{renewal_id}/status' \
  -H 'Content-Type: application/json' \
  -d '{"status": "SEND_THREE_DAY_NOTICE"}'
```