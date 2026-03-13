import { Injectable, Logger } from '@nestjs/common';
import { MriCoreService } from './mri-core.service';

export interface MriCommercialLeaseCmreccRaw {
  BuildingID: string;
  LeaseID: string;
  StartDate: string;
  EndDate: string | null;
  Frequency: string;
  IncomeCategoryDescription: string;
  Amount: string;
  CurrentlyinEffect: string; // 'Y' or 'N'
  LastUpdate: string;
  FeeExempt: string;
  ChargeDay: string;
  ChargedInAdvance: string;
  LastBillingDate: string;
  CurrencyCode: string | null;
  BillingMonth: string;
  RentTaxGroupID: string;
  BillingAddressID: string | null;
  ReviewAgreed: string | null;
}

export interface ProcessedRentCharges {
  baseRent: number;
  cam: number;
  ins: number;
  tax: number;
  monthlyRent: number;
  totalDueMonthly: number;
}

@Injectable()
export class MriCommercialLeasesCmreccService {
  private readonly logger = new Logger(MriCommercialLeasesCmreccService.name);

  constructor(private readonly mri: MriCoreService) {}

  /**
   * Fetch commercial lease charges (CMRECC) for a building/lease.
   * Uses MRI_S-PMCM_CommercialLeasesCmreccByBuildingID API.
   */
  async fetch(buildingId: string, leaseId?: string): Promise<MriCommercialLeaseCmreccRaw[]> {
    this.logger.debug(
      `Fetching commercial lease charges | buildingId=${buildingId} leaseId=${leaseId ?? 'ALL'}`,
    );

    const params: Record<string, string> = { BLDGID: buildingId };
    if (leaseId) params.LEASEID = leaseId; // Changed from LeaseID to LEASEID

    const result = await this.mri.get<MriCommercialLeaseCmreccRaw[]>(
      'MRI_S-PMCM_CommercialLeasesCmreccByBuildingID',
      params,
    );

    const records = result ?? [];
    this.logger.log(`✅ Commercial lease charges fetched: ${records.length} records for building ${buildingId} lease ${leaseId ?? 'ALL'}`);
    return records;
  }

  /**
   * Process raw CMRECC data to extract rent components
   * Only processes currently active charges (CurrentlyinEffect = 'Y')
   */
  processRentCharges(records: MriCommercialLeaseCmreccRaw[], leaseId?: string): ProcessedRentCharges {
    // Filter for specific lease if provided, and only active charges
    const activeCharges = records.filter(record => {
      const isActive = record.CurrentlyinEffect === 'Y';
      const isCorrectLease = !leaseId || record.LeaseID === leaseId;
      return isActive && isCorrectLease;
    });

    let baseRent = 0;
    let cam = 0;
    let ins = 0;
    let tax = 0;
    let totalDueMonthly = 0;

    for (const charge of activeCharges) {
      const amount = parseFloat(charge.Amount) || 0;
      
      switch (charge.IncomeCategoryDescription?.toUpperCase()) {
        case 'BRR':
        case 'RNT':
        case 'RENT':
        case 'BASE':
          baseRent += amount;
          totalDueMonthly += amount;
          break;
        case 'CAM':
          cam += amount;
          totalDueMonthly += amount;
          break;
        case 'INS':
          ins += amount;
          totalDueMonthly += amount;
          break;
        case 'RET':
        case 'STX':
        case 'TAX':
          tax += amount;
          totalDueMonthly += amount;
          break;
        default:
          // Include any other recurring charges in total
          totalDueMonthly += amount;
          break;
      }
    }

    const monthlyRent = baseRent; // Usually same as base rent

    this.logger.debug(`Processed ${activeCharges.length} active charges for lease ${leaseId ?? 'ALL'}: baseRent=${baseRent}, cam=${cam}, ins=${ins}, tax=${tax}, totalDueMonthly=${totalDueMonthly}`);

    return {
      baseRent,
      cam,
      ins,
      tax,
      monthlyRent,
      totalDueMonthly,
    };
  }

  /**
   * Fetch and process rent charges for a specific lease
   */
  async fetchAndProcessRentCharges(buildingId: string, leaseId: string): Promise<ProcessedRentCharges> {
    const records = await this.fetch(buildingId, leaseId);
    return this.processRentCharges(records, leaseId);
  }
}