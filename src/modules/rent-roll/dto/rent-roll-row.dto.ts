export interface RentRollRow {
  propertyName: string;
  tenantName: string;
  suite: string;
  sf: number;
  options: string; // e.g., "Renewal"
  annualRentPerSF: number; // Calculated
  nnnPerSF: number;      // Calculated
  arBalance: number;
  notes: string;
  optionTerm: string;    // e.g., "Start - End"
}
