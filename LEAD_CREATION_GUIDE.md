# Lead Creation Guide - Data Structure Requirements

## Overview
This guide explains what data structure leads should have when created to appear correctly in different filter scenarios.

---

## 1. Regular Lead (NOT a Lease)

### When to use:
- Initial lead creation
- Prospects that haven't become leases yet
- Leads in negotiation, qualification, etc.

### Required structure:
```json
{
  "status": "Prospect",
  "general": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "property": "Midpoint",
    "suite": "101"
  },
  "business": {},
  "financial": {},
  // ... other fields ...
  
  // ❌ DO NOT include "lease" field
  // OR
  // ✅ Set it to null explicitly
  "lease": null
}
```

### Will appear in:
- `GET /api/leasing/active-leads` (no filter)
- `GET /api/leasing/active-leads?isLease=false`

---

## 2. Lease Lead

### When to use:
- When a lead becomes an actual lease
- When lease is submitted for approval
- When lease is being negotiated

### Required structure:
```json
{
  "status": "Prospect",
  "general": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "property": "Midpoint",
    "suite": "101"
  },
  // ... other fields ...
  
  // ✅ Include lease object with valid status
  "lease": {
    "submittedBy": "John Doe",
    "submittedTo": "Manager Name",
    "submittedDate": "2026-02-27",
    "approvedDate": "",
    "status": "PENDING"  // See valid values below
  }
}
```

### Valid Lease Status Values:
- `PENDING` - Lease submitted, waiting for review
- `IN_REVIEW` - Lease is being reviewed
- `APPROVED` - Lease has been approved
- `LEASE_NEGOTIATION` - Lease terms are being negotiated
- `OUT_FOR_EXECUTION` - Lease sent for signatures
- `DRAFTING_LEASE` - Lease document is being drafted

### Will appear in:
- `GET /api/leasing/active-leads` (no filter)
- `GET /api/leasing/active-leads?isLease=true`
- `GET /api/leasing/active-leads?lease_status=PENDING` (specific status)
- `GET /api/leasing/active-leads?lease_status=APPROVAL_ALL` (group filter)

---

## 3. Filter Groups

### Lease Status Groups:
- **APPROVAL_ALL**: Shows leases with status `PENDING` or `IN_REVIEW`
  ```
  GET /api/leasing/active-leads?lease_status=APPROVAL_ALL
  ```

- **LEASE_ALL**: Shows leases with status `LEASE_NEGOTIATION`, `OUT_FOR_EXECUTION`, or `DRAFTING_LEASE`
  ```
  GET /api/leasing/active-leads?lease_status=LEASE_ALL
  ```

### Lead Status Groups:
- **TENANT_AR_ALL**: Shows leads with status `SEND_TO_ATTORNEY`, `SEND_COURTESY_NOTICE`, or `SEND_THREE_DAY_NOTICE`
  ```
  GET /api/leasing/active-leads?lead_status=TENANT_AR_ALL
  ```

- **LEAD_FOR_ALL**: Shows leads with status `LOI_NEGOTIATION`, `LEASE_NEGOTIATION`, `QUALIFYING`, or `OUT_FOR_EXECUTION`
  ```
  GET /api/leasing/active-leads?lead_status=LEAD_FOR_ALL
  ```

---

## 4. Common Mistakes

### ❌ WRONG - Using filter group name as status:
```json
{
  "lease": {
    "status": "LEASE_ALL"  // This is a filter group, not a valid status!
  }
}
```

### ❌ WRONG - Empty lease object:
```json
{
  "lease": {
    "submittedBy": "",
    "submittedTo": "",
    "submittedDate": "",
    "approvedDate": "",
    "status": ""  // Empty status
  }
}
```

### ✅ CORRECT - Regular lead:
```json
{
  "lease": null  // or don't include the field at all
}
```

### ✅ CORRECT - Lease lead:
```json
{
  "lease": {
    "submittedBy": "John Doe",
    "submittedTo": "Manager",
    "submittedDate": "2026-02-27",
    "status": "PENDING"  // Valid status
  }
}
```

---

## 5. API Filter Examples

### Show all leads (both regular and leases):
```
GET /api/leasing/active-leads?page=1&limit=20
```

### Show only regular leads (not leases):
```
GET /api/leasing/active-leads?isLease=false&page=1&limit=20
```

### Show only lease leads:
```
GET /api/leasing/active-leads?isLease=true&page=1&limit=20
```

### Show leases pending approval:
```
GET /api/leasing/active-leads?isLease=true&lease_status=APPROVAL_ALL
```

### Show leases in negotiation/execution:
```
GET /api/leasing/active-leads?isLease=true&lease_status=LEASE_ALL
```

### Show leads in LOI/Lease negotiation or qualifying:
```
GET /api/leasing/active-leads?lead_status=LEAD_FOR_ALL
```

### Show leads with AR issues:
```
GET /api/leasing/active-leads?lead_status=TENANT_AR_ALL
```

### Show leads by property:
```
GET /api/leasing/active-leads?property=Midpoint
```

### Search leads:
```
GET /api/leasing/active-leads?search=John
```

---

## 6. Schema Defaults

After the recent fixes:
- New leads will NOT have a `lease` object by default
- The `lease` field will be `undefined` (not included) unless explicitly set
- This means new leads will automatically appear in the regular leads list (`isLease=false`)

---

## 7. Migration for Existing Data

If you have existing leads with invalid data (like `"status": "LEASE_ALL"`), you need to:

1. Find all leads with invalid lease status
2. Either:
   - Remove the `lease` object (if they're not actual leases)
   - Update the `status` to a valid value (if they are leases)

Example MongoDB query to find invalid leads:
```javascript
db.leads.find({
  "lease.status": { $in: ["LEASE_ALL", "APPROVAL_ALL", "", null] }
})
```

Example fix (remove invalid lease objects):
```javascript
db.leads.updateMany(
  { "lease.status": { $in: ["LEASE_ALL", "APPROVAL_ALL", ""] } },
  { $unset: { lease: "" } }
)
```
