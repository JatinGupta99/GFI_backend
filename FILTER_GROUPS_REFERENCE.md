# Filter Groups Reference

## Overview
Filter groups allow you to query multiple statuses at once using a single filter parameter.

---

## Lease Status Filter Groups

### 1. APPROVAL_ALL
**Description**: Shows all leases pending approval or in review

**Includes lease statuses:**
- `PENDING`
- `IN_REVIEW`

**API Usage:**
```
GET /api/leasing/active-leads?isLease=true&lease_status=APPROVAL_ALL
```

**Use Case:** View all leases that need approval or are being reviewed

---

### 2. LEASE_ALL
**Description**: Shows all leases in negotiation, execution, or drafting phase

**Includes lease statuses:**
- `LEASE_NEGOTIATION`
- `OUT_FOR_EXECUTION`
- `DRAFTING_LEASE`

**API Usage:**
```
GET /api/leasing/active-leads?isLease=true&lease_status=LEASE_ALL
```

**Use Case:** View all active leases being worked on

---

## Lead Status Filter Groups

### 1. TENANT_AR_ALL
**Description**: Shows all leads with accounts receivable issues

**Includes lead statuses:**
- `SEND_TO_ATTORNEY`
- `SEND_COURTESY_NOTICE`
- `SEND_THREE_DAY_NOTICE`

**API Usage:**
```
GET /api/leasing/active-leads?lead_status=TENANT_AR_ALL
```

**Use Case:** View all leads with payment/AR issues that need attention

---

### 2. LEAD_FOR_ALL
**Description**: Shows all leads in active negotiation or qualification phase

**Includes lead statuses:**
- `LOI_NEGOTIATION`
- `LEASE_NEGOTIATION`
- `QUALIFYING`
- `OUT_FOR_EXECUTION`

**API Usage:**
```
GET /api/leasing/active-leads?lead_status=LEAD_FOR_ALL
```

**Use Case:** View all leads actively being worked on (negotiating, qualifying, or executing)

---

## Complete Status Lists

### Valid Lead Statuses (lead.status)
```typescript
- PROCESSING
- REVIEW_REQUIRED
- PENDING
- FAILED
- NO_CONTACT
- RENEWAL_NEGOTIATION
- DRAFTING_AMENDMENT
- LOST
- PROSPECT
- NEW
- CONTACTED
- QUALIFIED
- SITE_VISIT_SCHEDULED
- PROPOSAL_SENT
- NEGOTIATION
- CONTRACT_SENT
- WON
- LOI_NEGOTIATION          // ← Part of LEAD_FOR_ALL
- LEASE_NEGOTIATION        // ← Part of LEAD_FOR_ALL
- QUALIFYING               // ← Part of LEAD_FOR_ALL
- OUT_FOR_EXECUTION        // ← Part of LEAD_FOR_ALL
- SEND_TO_ATTORNEY         // ← Part of TENANT_AR_ALL
- SEND_COURTESY_NOTICE     // ← Part of TENANT_AR_ALL
- SEND_THREE_DAY_NOTICE    // ← Part of TENANT_AR_ALL
```

### Valid Lease Statuses (lease.status)
```typescript
- PENDING                  // ← Part of APPROVAL_ALL
- IN_REVIEW                // ← Part of APPROVAL_ALL
- APPROVED
- LEASE_NEGOTIATION        // ← Part of LEASE_ALL
- OUT_FOR_EXECUTION        // ← Part of LEASE_ALL
- DRAFTING_LEASE           // ← Part of LEASE_ALL
```

---

## Filter Combinations

### Example 1: Active leases pending approval
```
GET /api/leasing/active-leads?isLease=true&lease_status=APPROVAL_ALL
```

### Example 2: Leads in negotiation at specific property
```
GET /api/leasing/active-leads?lead_status=LEAD_FOR_ALL&property=Midpoint
```

### Example 3: AR issues at specific property
```
GET /api/leasing/active-leads?lead_status=TENANT_AR_ALL&property=Richwood
```

### Example 4: Search within active leads
```
GET /api/leasing/active-leads?lead_status=LEAD_FOR_ALL&search=John
```

---

## Important Notes

1. **Filter groups are NOT valid status values** - Don't use them when creating or updating leads
2. **Use filter groups only in API queries** - They are query parameters, not data values
3. **Combine filters** - You can combine `lead_status`, `lease_status`, `property`, and `search` filters
4. **Case sensitive** - Filter group names are case sensitive (use uppercase)

---

## Common Mistakes

### ❌ WRONG - Using filter group as status value:
```json
{
  "status": "LEAD_FOR_ALL"  // This is a filter group, not a valid status!
}
```

### ✅ CORRECT - Using actual status:
```json
{
  "status": "LOI_NEGOTIATION"  // This is a valid lead status
}
```

### ❌ WRONG - Using filter group in lease object:
```json
{
  "lease": {
    "status": "LEASE_ALL"  // This is a filter group, not a valid lease status!
  }
}
```

### ✅ CORRECT - Using actual lease status:
```json
{
  "lease": {
    "status": "PENDING"  // This is a valid lease status
  }
}
```
