export interface UpcomingRenewal {
    id: string;
    tenant: string;
    property: string;
    suite: string;
    sf: number;
    expDate: string;
    option: 'Yes' | 'No' | 'N/A';
    optionTerm?: string;
    rentPerSf: number;
    ti: string | number; // Tenant Improvement
    lcd: string;        // Lease Commencement Date
    budgetSf: number;
    budgetRent: number;
    budgetLcd: string;
    status: 'Renewal Negotiation' | 'Drafting Amendment' | 'No Contact' | 'Renewed' | 'Out for Execution' | string;
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
