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
