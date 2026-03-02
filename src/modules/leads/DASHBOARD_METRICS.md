# Dashboard Metrics API

## Overview
This document describes the dashboard metrics implementation for the leads module. The metrics provide real-time insights into the approval pipeline and deal performance.

## Endpoint

### GET `/leasing/active-leads/dashboard/metrics`

Returns comprehensive dashboard metrics for lead approvals and deals.

**Authentication:** Required

**Response:**
```json
{
  "statusCode": 200,
  "message": "Dashboard metrics retrieved successfully",
  "data": {
    "pendingApprovals": {
      "count": 5,
      "totalSF": 12500
    },
    "pendingApprovalsOverTwoDays": {
      "count": 2,
      "totalSF": 5000
    },
    "avgDaysToApprove": 3,
    "approvedDealsLast30Days": {
      "count": 8,
      "totalSF": 20000
    }
  }
}
```

## Metrics Explained

### 1. Pending Approvals
- **Description:** Total number of leads awaiting approval
- **Filter:** `approval_status` is either `PENDING` or `IN_REVIEW`
- **Returns:** Count and total square footage

### 2. Pending Approvals (>2 Days)
- **Description:** Leads pending approval for more than 2 days
- **Filter:** 
  - `approval_status` is `PENDING` or `IN_REVIEW`
  - `lease.submittedDate` is older than 2 days, OR
  - If no `submittedDate`, `createdAt` is older than 2 days
- **Returns:** Count and total square footage
- **Use Case:** Identify bottlenecks in the approval process

### 3. Average Days to Approve
- **Description:** Average time taken to approve deals
- **Calculation:** 
  - Only includes leads with `approval_status: 'APPROVED'`
  - Calculates difference between `lease.approvedDate` and `lease.submittedDate`
  - Returns rounded average in days
- **Returns:** Number (days)

### 4. Approved Deals (Last 30 Days)
- **Description:** Deals approved in the last 30 days
- **Filter:** 
  - `approval_status: 'APPROVED'`
  - `lease.approvedDate` within last 30 days
- **Returns:** Count and total square footage

## Implementation Details

### Service Methods

#### `getDashboardMetrics()`
Main method that orchestrates all metric calculations using `Promise.all()` for parallel execution.

#### `getPendingApprovals()`
Uses MongoDB aggregation to count and sum SF for pending approvals.

#### `getPendingApprovalsOverTwoDays()`
Uses MongoDB aggregation with date filtering to identify stale approvals.

#### `getAvgDaysToApprove()`
Uses MongoDB aggregation to calculate average approval time.

#### `getApprovedDealsLast30Days()`
Uses MongoDB aggregation with date range filtering.

### Database Schema Requirements

The metrics rely on the following fields in the Lead schema:

```typescript
{
  approval_status: string,        // 'PENDING', 'IN_REVIEW', 'APPROVED'
  general: {
    sf: string                    // Square footage (converted to number)
  },
  lease: {
    submittedDate: Date,          // When lease was submitted for approval
    approvedDate: Date            // When lease was approved
  },
  createdAt: Date                 // Auto-generated timestamp
}
```

### Performance Considerations

1. **Indexes:** Ensure indexes exist on:
   - `approval_status`
   - `lease.submittedDate`
   - `lease.approvedDate`
   - `createdAt`

2. **Parallel Execution:** All metrics are fetched in parallel using `Promise.all()` for optimal performance.

3. **Error Handling:** Wrapped in try-catch with proper logging and error responses.

## Usage Examples

### Frontend Integration

```typescript
// Fetch dashboard metrics
const response = await fetch('/leasing/active-leads/dashboard/metrics', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { data } = await response.json();

// Display metrics
console.log(`Pending Approvals: ${data.pendingApprovals.count} (${data.pendingApprovals.totalSF} SF)`);
console.log(`Overdue (>2 days): ${data.pendingApprovalsOverTwoDays.count}`);
console.log(`Avg Days to Approve: ${data.avgDaysToApprove}`);
console.log(`Approved Last 30 Days: ${data.approvedDealsLast30Days.count}`);
```

### Dashboard Component Example

```tsx
import React, { useEffect, useState } from 'react';

const DashboardMetrics = () => {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    fetch('/leasing/active-leads/dashboard/metrics')
      .then(res => res.json())
      .then(result => setMetrics(result.data));
  }, []);

  if (!metrics) return <div>Loading...</div>;

  return (
    <div className="dashboard-metrics">
      <MetricCard
        title="Pending Approvals"
        count={metrics.pendingApprovals.count}
        sf={metrics.pendingApprovals.totalSF}
      />
      <MetricCard
        title="Pending Approvals (>2 Days)"
        count={metrics.pendingApprovalsOverTwoDays.count}
        sf={metrics.pendingApprovalsOverTwoDays.totalSF}
        alert={metrics.pendingApprovalsOverTwoDays.count > 0}
      />
      <MetricCard
        title="Avg. Days to Approve"
        value={metrics.avgDaysToApprove}
      />
      <MetricCard
        title="Approved Deals (30 Days)"
        count={metrics.approvedDealsLast30Days.count}
        sf={metrics.approvedDealsLast30Days.totalSF}
      />
    </div>
  );
};
```

## Testing

### Manual Testing

```bash
# Test the endpoint
curl -X GET http://localhost:3000/leasing/active-leads/dashboard/metrics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Expected Response Structure

```json
{
  "statusCode": 200,
  "message": "Dashboard metrics retrieved successfully",
  "data": {
    "pendingApprovals": {
      "count": 0,
      "totalSF": 0
    },
    "pendingApprovalsOverTwoDays": {
      "count": 0,
      "totalSF": 0
    },
    "avgDaysToApprove": 0,
    "approvedDealsLast30Days": {
      "count": 0,
      "totalSF": 0
    }
  }
}
```

## Troubleshooting

### Issue: Metrics return 0 for all values
**Solution:** Check that:
1. Leads exist in the database
2. `approval_status` field is properly set
3. `lease.submittedDate` and `lease.approvedDate` are populated for approved leads

### Issue: SF values are incorrect
**Solution:** Ensure `general.sf` field contains valid numeric strings. The aggregation uses `$convert` with error handling to safely convert to numbers.

### Issue: Slow performance
**Solution:** 
1. Add database indexes on filtered fields
2. Check database query execution time
3. Consider caching metrics if real-time data isn't critical

## Future Enhancements

1. **Caching:** Implement Redis caching for metrics with 5-minute TTL
2. **Filtering:** Add property-based filtering for multi-property dashboards
3. **Historical Data:** Track metrics over time for trend analysis
4. **Alerts:** Automated notifications for overdue approvals
5. **Export:** CSV/PDF export functionality for reports
