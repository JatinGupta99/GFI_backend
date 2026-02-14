export interface RentRollRow {
  propertyName: string;
  tenantName: string;
  suite: string;
  sf: number;
  expDate: string;
  options: string; // e.g., "Yes/No"
  optionTerm: string;    // e.g., "60 months"
  currentRentPerSF: number; // Calculated
  budgetRenew: string;      // Budget Status/Type
  budgetRentPerSF: number;
  budgetTIPerSF: number;
  budgetRCD: string;
  status: string;           // Occupancy Status
  arBalance: number;
  notes: string;
}
