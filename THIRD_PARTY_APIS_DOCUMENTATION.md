# Third-Party APIs Documentation

This document lists all third-party APIs and external services integrated in the application.

---

## Overview

The application integrates with the following third-party services:
1. **MRI Software** - Property Management System (10 APIs)
2. **DocuSign** - Electronic Signature Service
3. **Google Document AI** - Document Processing
4. **AWS S3** - File Storage
5. **SendGrid/SMTP** - Email Service

---

## 1. MRI Software APIs

**Base URL:** `https://pmx7api.cloud.mrisoftware.com/mriapiservices/api.asp`

**Authentication:** Developer API Key + Web Service User credentials

### MRI API List

#### 1.1 Commercial Lease APIs

| # | API Name | Service File | Purpose | Parameters |
|---|----------|--------------|---------|------------|
| 1 | `MRI_S-PMCM_CommercialLeasesLeasByBuildingID` | `mri-leases.service.ts` | Get all leases for a building | `BLDGID`, `$top`, `$skip`, `$filter` |
| 2 | `MRI_S-PMCM_CommercialLeaseAnlsByBuildingID` | `mri-analysis.service.ts` | Get lease analysis data | `BLDGID`, `LEASEID` (optional) |
| 3 | `MRI_S-PMCM_CommercialLeasesLeasOptsByBuildingID` | `mri-options.service.ts` | Get lease options | `BLDGID`, `LEASEID` (optional) |
| 4 | `MRI_S-PMCM_LeaseEMEAInformation` | `mri-lease-eme