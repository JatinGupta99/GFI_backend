export interface UpcomingRenewal {
    id: string;           // mriLeaseId (LeaseID)
    tenantId?: string;    // MasterOccupantID
    tenant: string;       // OccupantName / LegalName
    address?: string;     // Address1, City, State Zip
    property: string;
    suite: string;
    sf: string;
    expDate: string;
    option: 'Yes' | 'No' | 'N/A';
    optionTerm?: string;
    rentPerSf?: number;
    tiPerSf: string;
    budgetSf: string;
    budgetRent?: number;
    status: string;
    note?: string;

    // Additional MRI fields
    leaseId?: string;
    legalName?: string;
    OccupantName?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    leaseStop?: string;
    origSqFt?: string;
    term?: string;
    billingEmailAddress?: string;
    emailAddress?: string;

    // MRI Report API Data
    monthlyRent?: number;
    cam?: number;
    ins?: number;
    tax?: number;
    totalDueMonthly?: number;
    balanceForward?: number;
    cashReceived?: number;
    balanceDue?: number;
    days0To30?: string;
    days31To60?: string;
    days61Plus?: string;
}
