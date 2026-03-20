import { Injectable, Logger } from '@nestjs/common';
import { MriCoreService } from '../../rent-roll/mri/mri-core.service';

export interface MriDelinquencyData {
  LeaseID: string;
  DelinquentAmount: number;
  ThirtyDayDelinquency: number;
  SixtyDayDelinquency: number;
  NinetyDayDelinquency: number;
  NinetyPlusDayDelinquency: number;
  PrepaidCharges: number;
}

export interface MriTenantLedgerData {
  LeaseID: string;
  TransactionDate: string;
  TransactionType: string;
  Amount: number;
  Balance: number;
  Description: string;
}

@Injectable()
export class MriFinancialService {
  private readonly logger = new Logger(MriFinancialService.name);

  constructor(private readonly mriCore: MriCoreService) {}

  async getCurrentDelinquencies(propertyId: string, leaseId?: string): Promise<MriDelinquencyData[]> {
    try {
      const params: any = { BuildingID: propertyId };
      if (leaseId) {
        params.LeaseID = leaseId;
      }

      const delinquencies = await this.mriCore.get<MriDelinquencyData[]>(
        'MRI_S-PMCM_CurrentDelinquencies',
        params
      );

      this.logger.log(`📋 Retrieved ${delinquencies?.length || 0} delinquency records for property ${propertyId}`);
      return delinquencies || [];
    } catch (error) {
      this.logger.error(`Failed to get delinquencies for property ${propertyId}: ${error.message}`);
      return [];
    }
  }

  async getTenantLedger(propertyId: string, leaseId: string, startDate: string, endDate: string): Promise<MriTenantLedgerData[]> {
    try {
      const params = {
        BuildingID: propertyId,
        LeaseID: leaseId,
        StartDate: startDate,
        EndDate: endDate
      };

      const ledger = await this.mriCore.get<MriTenantLedgerData[]>(
        'MRI_S-PMCM_TenantLedger',
        params
      );

      this.logger.log(`📋 Retrieved ${ledger?.length || 0} ledger entries for lease ${leaseId}`);
      return ledger || [];
    } catch (error) {
      this.logger.error(`Failed to get tenant ledger for lease ${leaseId}: ${error.message}`);
      return [];
    }
  }

  async getCommercialLedger(propertyId: string, leaseId: string, startDate?: string, endDate?: string): Promise<any[]> {
    try {
      const params: any = { 
        BuildingID: propertyId,
        LeaseID: leaseId
      };
      
      if (startDate) params.StartDate = startDate;
      if (endDate) params.EndDate = endDate;

      const ledgerData = await this.mriCore.get<any[]>(
        'MRI_S-PMCM_CommercialLedger',
        params
      );

      this.logger.log(`📋 Retrieved ${ledgerData?.length || 0} commercial ledger records for lease ${leaseId}`);
      return ledgerData || [];
    } catch (error) {
      this.logger.error(`Failed to get commercial ledger for lease ${leaseId}: ${error.message}`);
      return [];
    }
  }

  async getOpenCharges(propertyId: string, leaseId?: string): Promise<any[]> {
    try {
      const params: any = { BuildingID: propertyId };
      if (leaseId) {
        params.LeaseID = leaseId;
      }

      const openCharges = await this.mriCore.get<any[]>(
        'MRI_S-PMCM_OpenCharges',
        params
      );

      this.logger.log(`📋 Retrieved ${openCharges?.length || 0} open charges for property ${propertyId}`);
      return openCharges || [];
    } catch (error) {
      this.logger.error(`Failed to get open charges for property ${propertyId}: ${error.message}`);
      return [];
    }
  }

  async getLeaseBudget(propertyId: string, leaseId?: string): Promise<any[]> {
    try {
      const params: any = { BuildingID: propertyId };
      if (leaseId) {
        params.LeaseID = leaseId;
      }

      const leaseBudget = await this.mriCore.get<any[]>(
        'MRI_S-PMCM_LeaseEMEAInformation',
        params
      );

      this.logger.log(`📋 Retrieved ${leaseBudget?.length || 0} lease budget records for property ${propertyId}`);
      return leaseBudget || [];
    } catch (error) {
      this.logger.error(`Failed to get lease budget for property ${propertyId}: ${error.message}`);
      return [];
    }
  }

  async getOpenCredits(propertyId: string, leaseId?: string): Promise<any[]> {
    try {
      const params: any = { BuildingID: propertyId };
      if (leaseId) {
        params.LeaseID = leaseId;
      }

      const credits = await this.mriCore.get<any[]>(
        'MRI_S-PMCM_OpenCredits',
        params
      );

      this.logger.log(`📋 Retrieved ${credits?.length || 0} open credits for property ${propertyId}`);
      return credits || [];
    } catch (error) {
      this.logger.error(`Failed to get open credits for property ${propertyId}: ${error.message}`);
      return [];
    }
  }
}