import { IsOptional, IsString } from 'class-validator';

export class BudgetUploadDto {
  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class BudgetUploadResponseDto {
  success: boolean;
  message: string;
  propertyId: string;
  suitesProcessed: number;
  extractionLogs: string[];
  suites: BudgetSuiteUpdateDto[];
}

export class BudgetSuiteUpdateDto {
  suiteId: string;
  propertyId: string;
  squareFootage: number;
  tiPerSf: string;
  baseRentPerSf: string;
  camPerSf: string;
  insPerSf: string;
  taxPerSf: string;
  rcd: string | null;
  charges: {
    baseRentMonth: number;
    camMonth: number;
    insMonth: number;
    taxMonth: number;
    totalDueMonth: number;
  };
  balanceDue: number;
  leaseTerms: {
    rentDueDate: string | null;
    lateAfter: string | null;
    lateFee: number;
  };
  monthlyPayments: {
    jan: number;
    feb: number;
    mar: number;
    apr: number;
    may: number;
    jun: number;
    jul: number;
    aug: number;
    sept: number;
    oct: number;
    nov: number;
    dec: number;
  };
  status: string;
}