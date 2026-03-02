# Fix Approvals Page CSS Overlapping Issue

## Feature Overview
Fix CSS overlapping issue on the approvals/pending page where tenant and suite information is overlapping, similar to the fix that was previously applied to the lease page.

## Problem Statement
On the frontend page `http://localhost:3000/approvals/pending`, the tenant name and suite number are overlapping, making the information difficult to read. This same issue was previously fixed on the lease page, and the same solution should be applied to the approvals page.

## User Story
As a user viewing the approvals/pending page,
I want the tenant and suite information to be displayed without overlapping,
So that I can easily read and identify each approval item.

## Acceptance Criteria

### 1.1 Visual Layout
The tenant name and suite number must be displayed without overlapping on the approvals/pending page.

### 1.2 Consistency
The CSS fix must match the solution previously applied to the lease page for visual consistency across the application.

### 1.3 Responsive Design
The fix must work across different screen sizes and maintain proper spacing.

### 1.4 No Regression
The fix must not break any existing layout or styling on the approvals page.

## Technical Context

### Backend API
The backend API endpoint `GET /leasing/active-leads/dashboard/metrics` returns approval metrics including:
- Pending Approvals (count and totalSF)
- Pending Approvals >2 Days (count and totalSF)
- Average Days to Approve
- Approved Deals Last 30 Days (count and totalSF)

The data structure includes:
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
      "count": 10,
      "totalSF": 25000
    }
  }
}
```

### Frontend Issue
This is a **frontend CSS issue** that needs to be fixed in the React/Vue/Angular component that renders the approvals list. The issue is in the styling, not in the API data.

### Reference Fix
The lease page previously had the same overlapping issue and was fixed with CSS adjustments. The same CSS solution should be applied to the approvals page.

## Out of Scope
- Backend API changes (the API is working correctly)
- Data structure modifications
- New features or functionality

## Notes
- This is a frontend-only fix
- The backend API is functioning correctly and returns all necessary data
- The fix should reference the CSS solution used on the lease page
- No backend code changes are required
