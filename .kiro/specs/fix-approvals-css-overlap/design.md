# Design Document: Fix Approvals Page CSS Overlapping

## Overview
This document outlines the design for fixing the CSS overlapping issue on the approvals/pending page where tenant and suite information overlap.

## Problem Analysis
The approvals page at `http://localhost:3000/approvals/pending` displays a list of pending approvals with tenant names and suite numbers. Currently, these elements are overlapping, making the information difficult to read.

## Solution Design

### Frontend Component Structure
The approvals page likely has a component structure similar to:
```
ApprovalsList
  └── ApprovalItem (repeated for each approval)
      ├── TenantInfo
      │   ├── Tenant Name
      │   └── Suite Number
      └── Other Details
```

### CSS Fix Strategy
Based on the reference fix applied to the lease page, the solution involves:

1. **Proper Spacing**: Add adequate margin/padding between tenant name and suite number
2. **Flex Layout**: Use flexbox or grid to ensure proper alignment
3. **Text Wrapping**: Ensure long tenant names wrap properly without overlapping
4. **Responsive Design**: Maintain proper spacing across different screen sizes

### Recommended CSS Changes

#### Option 1: Flexbox Layout
```css
.approval-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tenant-info {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.tenant-name {
  flex: 1;
  min-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.suite-number {
  flex-shrink: 0;
  padding: 4px 8px;
  background: #f0f0f0;
  border-radius: 4px;
}
```

#### Option 2: Grid Layout
```css
.approval-item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  align-items: center;
}

.tenant-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.suite-number {
  justify-self: end;
  padding: 4px 8px;
  background: #f0f0f0;
  border-radius: 4px;
}
```

### Implementation Steps

1. **Locate the Component**: Find the React/Vue/Angular component that renders the approvals list
2. **Identify CSS Classes**: Identify the CSS classes used for tenant and suite display
3. **Apply CSS Fix**: Apply the same CSS solution that was used on the lease page
4. **Test Responsiveness**: Test on different screen sizes (mobile, tablet, desktop)
5. **Verify No Regression**: Ensure other elements on the page are not affected

## Files to Modify

### Frontend Files (Likely Locations)
- `src/components/Approvals/ApprovalsList.tsx` (or .jsx, .vue)
- `src/components/Approvals/ApprovalItem.tsx`
- `src/styles/approvals.css` (or .scss, .module.css)
- `src/pages/Approvals/PendingApprovals.tsx`

### Reference Files
- Lease page component (for reference to the previous fix)
- Lease page CSS (for reference to the CSS solution)

## Testing Strategy

### Visual Testing
1. Open `http://localhost:3000/approvals/pending`
2. Verify tenant names and suite numbers do not overlap
3. Test with long tenant names
4. Test with multiple approvals in the list

### Responsive Testing
1. Test on mobile viewport (320px - 480px)
2. Test on tablet viewport (768px - 1024px)
3. Test on desktop viewport (1280px+)

### Cross-Browser Testing
1. Chrome
2. Firefox
3. Safari
4. Edge

## Correctness Properties

### Property 1: No Overlap
**Description**: Tenant name and suite number must never overlap regardless of content length or screen size.

**Test Strategy**: Visual inspection and automated screenshot comparison tests.

### Property 2: Consistent Spacing
**Description**: The spacing between tenant name and suite number must be consistent across all approval items.

**Test Strategy**: Measure spacing using browser dev tools and verify consistency.

### Property 3: Responsive Layout
**Description**: The layout must adapt properly to different screen sizes without breaking.

**Test Strategy**: Test on multiple viewport sizes and verify proper rendering.

## Notes
- This is a frontend-only fix
- No backend API changes required
- The fix should match the solution used on the lease page
- Consider using CSS variables for consistent spacing across the application
