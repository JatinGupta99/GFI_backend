# Requirements: Fix Commercial Property Renewals

## Problem Statement
The renewal sync system is identifying active leases but creating 0 renewal records in the database for commercial properties. The MRI Residential Renewal Offers API returns 400 Bad Request for commercial properties (expected behavior), but renewals should still be created without the renewal offer data.

**Tested with property 008353 (Lexington Plaza - commercial property):**
- 7 active leases identified
- All 7 tenants fail with 400 Bad Request on renewal offers API
- 0 renewals created in database

**This issue likely affects ALL commercial properties in the system.**

## Current Behavior
1. Sync identifies active leases correctly ✅
2. Attempts to fetch residential renewal offers for each tenant
3. Gets 400 Bad Request for commercial properties (expected) ✅
4. Error handling catches the 400 error gracefully ✅
5. **BUG**: 0 renewals are created in MongoDB ❌

## Expected Behavior
1. Sync identifies active leases ✅
2. Attempts to fetch renewal offers
3. Gracefully handles 400 errors for commercial properties ✅
4. **Creates renewal records WITHOUT renewal offer data** ❌ (currently broken)
5. Stores basic lease information (tenant, property, expiration date, etc.)
6. Works for both residential AND commercial properties

## Root Cause Analysis Needed
The code appears correct:
- `fetchTenantRenewalData` catches 400 errors and returns `undefined` for offers
- `transformToRenewalData` is called with `undefined` offer
- `transformToRenewalData` should create a valid `RenewalData` object
- `bulkUpsert` should insert the records

**Possible issues:**
1. EMEA service might also be failing (not caught)
2. `transformToRenewalData` might be throwing an error
3. `bulkUpsert` might be failing silently
4. Promise.allSettled might be filtering out the results incorrectly

## Acceptance Criteria

### 1.1 Identify Root Cause
- [ ] Add detailed logging to identify where renewals are being lost
- [ ] Log the output of `fetchTenantRenewalData` for each tenant
- [ ] Log the input to `bulkUpsert` to verify data is being passed
- [ ] Log the result of `bulkUpsert` to verify database operation

### 1.2 Fix Renewal Creation
- [ ] Ensure renewals are created even when renewal offers API returns 400
- [ ] Ensure renewals are created even when EMEA data is unavailable
- [ ] Handle all API errors gracefully without blocking renewal creation

### 1.3 Verification
- [ ] Full sync for all properties completes successfully
- [ ] Commercial properties create renewal records without renewal offer data
- [ ] Residential properties create renewal records with renewal offer data (if available)
- [ ] Property 008353 creates 7 renewal records
- [ ] Each renewal record contains basic lease information (tenant, property, expiration)
- [ ] Renewal records have `undefined` or `null` for renewal offer fields on commercial properties (expected)
- [ ] No errors in logs except expected 400 warnings for commercial properties

### 1.4 Performance
- [ ] Full sync completes in reasonable time (< 2 minutes for ~20 properties)
- [ ] Rate limiting prevents API throttling
- [ ] Parallel processing works correctly for all properties

## User Stories

### Story 1: Commercial Property Renewals
**As a** property manager  
**I want** to track renewals for commercial properties  
**So that** I can manage lease expirations even without residential renewal offer data

**Acceptance Criteria:**
- Renewals are created for commercial properties
- Missing renewal offer data doesn't block creation
- Basic lease information is stored correctly

### Story 2: Graceful Error Handling
**As a** system administrator  
**I want** API errors to be handled gracefully  
**So that** partial data failures don't prevent renewal tracking

**Acceptance Criteria:**
- 400 errors from renewal offers API are logged as warnings
- Renewals are still created with available data
- System continues processing other tenants after errors

## Technical Notes

### Files Involved
- `src/modules/renewals/providers/mri-renewal.provider.ts` - Main provider with error handling
- `src/modules/renewals/services/renewal-sync.service.ts` - Sync orchestration
- `src/modules/renewals/repositories/renewal.repository.ts` - Database operations

### MRI API Behavior
- `MRI_S-PMRM_ResidentialRenewalOffers` returns 400 for commercial properties (expected)
- `MRI_S-PMRM_LeaseEMEA` may also fail for commercial properties
- Base lease data from `MRI_S-PMRM_Leases` is always available

### Data Fields
Required fields (always available from lease data):
- `tenantId`, `propertyId`, `tenantName`, `unit`, `leaseEnd`, `mriLeaseId`

Optional fields (may be unavailable for commercial):
- `renewalOffer`, `optionTerm`, `budgetRent`, `budgetRentPerSf`, `budgetTI`, `budgetLCD`

## Success Metrics
- All properties sync successfully (both commercial and residential)
- Renewal records created for all active leases across all properties
- Property 008353 creates 7 renewal records
- Full sync completes in < 2 minutes
- No unhandled errors in logs
- Database contains valid renewal records with basic lease information for all properties

## Testing Strategy
1. **Single Property Test**: Sync property 008353 (commercial) - expect 7 renewals
2. **Full Sync Test**: Sync all properties - verify renewals created for each
3. **Mixed Property Test**: Verify both commercial and residential properties work
4. **Data Validation**: Check database records have correct structure and data
