export interface UpcomingRenewal {
    id: string;
    tenant: string;
    property: string;
    suite: string;
    sf: string; // Changed from number to string to match API response
    expDate: string;
    option: 'Yes' | 'No' | 'N/A';
    optionTerm?: string;
    rentPerSf?: number;
    tiPerSf: string; // Tenant Improvement (comes as string like "N/A")
 // Lease Commencement Date (comes as string like "N/A")
    budgetSf: string; // Changed from number to string to match API response
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
    days0To30?: string; // Comes as string like "0.00"
    days31To60?: string; // Comes as string like "0.00"
    days61Plus?: string; // Comes as string like "0.00"
}
