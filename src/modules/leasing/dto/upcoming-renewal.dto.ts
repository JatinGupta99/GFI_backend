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
}
