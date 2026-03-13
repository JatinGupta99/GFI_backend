import { Injectable, Logger } from '@nestjs/common';
import { MriCoreService } from '../../rent-roll/mri/mri-core.service';

export interface MriChargeData {
  LeaseID: string;
  IncomeCategoryDescription: string;
  Amount: number;
  Frequency: string;
  StartDate: string;
  CurrentlyInEffect: boolean;
}

@Injectable()
export class MriChargesService {
  private readonly logger = new Logger(MriChargesService.name);

  constructor(private readonly mriCore: MriCoreService) {}

  async getRecurringCharges(propertyId: string, leaseId?: string): Promise<MriChargeData[]> {
    try {
      const params: any = { BuildingID: propertyId };
      if (leaseId) {
        params.LeaseID = leaseId;
      }

      const charges = await this.mriCore.get<MriChargeData[]>(
        'MRI_S-PMCM_CommercialLeasesCmreccByBuildingID',
        params
      );

      this.logger.log(`📋 Retrieved ${charges?.length || 0} recurring charges for property ${propertyId}`);
      return charges || [];
    } catch (error) {
      this.logger.error(`Failed to get recurring charges for property ${propertyId}: ${error.message}`);
      return [];
    }
  }

  async getAnnualRentData(propertyId: string, leaseId?: string): Promise<any[]> {
    try {
      const params: any = { BuildingID: propertyId };
      if (leaseId) {
        params.LeaseID = leaseId;
      }

      const rentData = await this.mriCore.get<any[]>(
        'MRI_S-PMCM_AnnualRentPerSquareArea',
        params
      );

      this.logger.log(`📋 Retrieved ${rentData?.length || 0} annual rent records for property ${propertyId}`);
      return rentData || [];
    } catch (error) {
      this.logger.error(`Failed to get annual rent data for property ${propertyId}: ${error.message}`);
      return [];
    }
  }
}